import configparser
from datetime import datetime, timezone
from uuid import uuid4
from influxdb_client import Authorization, InfluxDBClient, Permission, PermissionResource, Point, WriteOptions
from influxdb_client.client.authorizations_api import AuthorizationsApi
from influxdb_client.client.bucket_api import BucketsApi
from influxdb_client.client.query_api import QueryApi
from influxdb_client.client.write_api import SYNCHRONOUS

import UpbeatLabs_MCP39F521.UpbeatLabs_MCP39F521 as UpbeatLabs_MCP39F521
import subprocess as sp
import time
import signal

import board
import busio
import digitalio 
import adafruit_ssd1306

from PIL import Image
from PIL import ImageDraw
from PIL import ImageFont

import RPi.GPIO as GPIO


WIDTH = 128
HEIGHT = 64

# Raspberry Pi pin configuration:
RST = digitalio.DigitalInOut(board.D12)
# Note the following are only used with SPI:
DC = digitalio.DigitalInOut(board.D18)
CS = digitalio.DigitalInOut(board.D8)

spi = busio.SPI(board.SCK, MOSI=board.MOSI)
disp = adafruit_ssd1306.SSD1306_SPI(WIDTH, HEIGHT, spi, DC, RST, CS)

wattson = UpbeatLabs_MCP39F521.UpbeatLabs_MCP39F521(0x74)

LED_PIN = 4
ZCD_PIN = 23
EVENT_PIN = 24

OVER_CURRENT_LIMIT  = 1800  # 0.18a
OVER_POWER_LIMIT    = 1600  # 16w
VOLTAGE_SAG_LIMIT   =  800   # 80v
VOLTAGE_SURGE_LIMIT = 1300  # 130v

eventTriggered = False

config = configparser.ConfigParser()
config.read('config.ini')

# First define some constants to allow easy resizing of shapes.
width = disp.width
height = disp.height
padding = 2
shape_width = 20
top = padding
bottom = height-padding
# Move left to right keeping track of the current x position for drawing shapes.
x = padding

# Load default font.
font = ImageFont.load_default()
image = Image.new('1', (width, height))
draw = ImageDraw.Draw(image)


def clear_display():
    # Clear display
    disp.fill(0)
    disp.show()

    # Draw a black filled box to clear the image.
    draw.rectangle((0,0,width,height), outline=0, fill=0)

def write_display(result):
    try: 
        draw.rectangle((0,0,width,height), outline=0, fill=0)
        # Write two lines of text.
        draw.text((x, top),    str("{:.2f}".format(result.voltageRMS)) + ' V | ' + str("{:.2f}".format(result.lineFrequency)) + ' Hz',  font=font, fill=255)
        draw.text((x, top+10), str("{:.4f}".format(result.currentRMS)) + ' A | PF: ' + str("{:.2f}".format(result.powerFactor)), font=font, fill=255)
        draw.text((x, top+20), '--------------------', font=font, fill=255)
        draw.text((x, top+30), str("{:.2f} W".format(result.activePower)), font=font, fill=255)
        draw.text((x, top+40), str("{:.2f} VAR".format(result.reactivePower)), font=font, fill=255)
        draw.text((x, top+50), str("{:.2f} VA".format(result.apparentPower)), font=font, fill=255)

        # Display image.
        imageRot = image.transpose(Image.ROTATE_180)
        disp.image(imageRot)
        disp.show()
    except Exception as err:
        print(result)
        print(f"Unexpected {err=}, {type(err)=}")
        raise

def get_buckets():
    influxdb_client = InfluxDBClient(url=config.get('APP', 'INFLUX_URL'),
                                     token=config.get('APP', 'INFLUX_TOKEN'),
                                     org=config.get('APP', 'INFLUX_ORG'))

    buckets_api = influxdb_client.buckets_api()
    buckets = buckets_api.find_buckets()
    return buckets


def get_device(device_id) -> {}:
    influxdb_client = InfluxDBClient(url=config.get('APP', 'INFLUX_URL'),
                                     token=config.get('APP', 'INFLUX_TOKEN'),
                                     org=config.get('APP', 'INFLUX_ORG'))
    # Queries must be formatted with single and double quotes correctly
    query_api = QueryApi(influxdb_client)
    device_id = str(device_id)
    device_filter = f'r.deviceId == "{device_id}" and r._field != "token"'
    flux_query = f'from(bucket: "{config.get("APP", "INFLUX_BUCKET_AUTH")}") ' \
                 f'|> range(start: 0) ' \
                 f'|> filter(fn: (r) => r._measurement == "deviceauth" and {device_filter}) ' \
                 f'|> last()'

    response = query_api.query(flux_query)
    results = []
    for table in response:
        for record in table.records:
            results.append((record.get_field(), record.get_value()))
    return results


def create_device(device_id=None):
    influxdb_client = InfluxDBClient(url=config.get('APP', 'INFLUX_URL'),
                                     token=config.get('APP', 'INFLUX_TOKEN'),
                                     org=config.get('APP', 'INFLUX_ORG'))

    if device_id is None:
        device_id = str(uuid4())

    write_api = influxdb_client.write_api(write_options=SYNCHRONOUS)

    point = Point('deviceauth') \
        .tag("deviceId", device_id) \
        .field('key', f'fake_auth_id_{device_id}') \
        .field('token', f'fake_auth_token_{device_id}')

    client_response = write_api.write(bucket=config.get('APP', 'INFLUX_BUCKET_AUTH'), record=point)

    # write() returns None on success
    if client_response is None:
        return device_id

    # Return None on failure
    return None

def query_all_data(device_id, duration, aggregateWindow) -> {}:
    influxdb_client = InfluxDBClient(url=config.get('APP', 'INFLUX_URL'),
                                     token=config.get('APP', 'INFLUX_TOKEN'),
                                     org=config.get('APP', 'INFLUX_ORG'))
    # Queries must be formatted with single and double quotes correctly
    query_api = QueryApi(influxdb_client)
    device_id = str(device_id)
    device_filter = f'r.device == "{device_id}" and r._field != "token"'

    flux_query = f'from(bucket: "{config.get("APP", "INFLUX_BUCKET")}") ' \
                 f'|> range(start: {duration} ) ' \
                 f'|> filter(fn: (r) => r._measurement == "wattson_measurement" and {device_filter})' \
                 f'|> aggregateWindow(every: {aggregateWindow}, fn: mean) ' \
                 f'|> map(fn: (r) => ( {{ r with _time: uint(v: r._time) }} ))' \
                 f'|> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")'


    print(flux_query)
    response = query_api.query(flux_query)
    results = []
    for table in response:
        for record in table.records:
            results.append({
                "time": record.get_time() // 1000000,                
                "CurrentRMS": str(record.values['CurrentRMS']),
                "VoltageRMS": str(record.values['VoltageRMS']),
                "LineFrequency": str(record.values['LineFrequency']),
                "PowerFactor": str(record.values['PowerFactor']),
                "ActivePower": str(record.values['ActivePower']),
                "ReactivePower": str(record.values['ReactivePower']),
                "ApparentPower": str(record.values['ApparentPower']),
                "ActiveEnergyImport": str(record.values['ActiveEnergyImport']),
                "ActiveEnergyExport": str(record.values['ActiveEnergyExport']),
                "ReactiveEnergyImport": str(record.values['ReactiveEnergyImport']),
                "ReactiveEnergyExport": str(record.values['ReactiveEnergyExport']),                
                })
    return results

def query_data(device_id, metric) -> {}:
    influxdb_client = InfluxDBClient(url=config.get('APP', 'INFLUX_URL'),
                                     token=config.get('APP', 'INFLUX_TOKEN'),
                                     org=config.get('APP', 'INFLUX_ORG'))
    # Queries must be formatted with single and double quotes correctly
    query_api = QueryApi(influxdb_client)
    device_id = str(device_id)
    device_filter = f'r.device == "{device_id}" and r._field != "token"'

    flux_query = f'from(bucket: "{config.get("APP", "INFLUX_BUCKET")}") ' \
                 f'|> range(start: -5m ) ' \
                 f'|> filter(fn: (r) => r._measurement == "wattson_measurement" and {device_filter})' \
                 f'|> filter(fn: (r) => r._field == "{metric}" ) ' \
                 f'|> aggregateWindow(every: 10s, fn: mean) ' \
                 f'|> map(fn: (r) => ( {{ r with _time: uint(v: r._time) }} ))'
                 
                 # f'|> aggregateWindow(every: 60s, fn: mean) '

    print(flux_query)
    response = query_api.query(flux_query)
    results = []
    for table in response:
        for record in table.records:
            results.append({
                "metric": record.get_field(),
                "value": record.get_value(),
                "time": record.get_time() // 1000000
                })
    return results
            

def initialize():
    GPIO.setmode(GPIO.BCM)
    GPIO.setwarnings(False)
    GPIO.setup(LED_PIN,GPIO.OUT)

    GPIO.setup(ZCD_PIN, GPIO.IN)
    GPIO.setup(EVENT_PIN, GPIO.IN)

    GPIO.add_event_detect(EVENT_PIN, GPIO.BOTH, event_handler)
    print("wattson initialized")

def cleanup():
    GPIO.remove_event_detect(EVENT_PIN)
    GPIO.output(LED_PIN, 0)
    GPIO.cleanup()


def event_handler(pin):
    global eventTriggered
    state = GPIO.input(pin)
    GPIO.output(LED_PIN, state)
    eventTriggered = state;

def setSystemConfig(voltageSagLimit = VOLTAGE_SAG_LIMIT, voltageSurgeLimit = VOLTAGE_SURGE_LIMIT, 
                    overCurrentLimit = OVER_CURRENT_LIMIT, overPowerLimit = OVER_POWER_LIMIT):
      (retVal, eventData) = wattson.readEventConfigRegister()

      print("eventConfigRegister is {}".format(eventData))

      (retVal, eventFlagLimits)  = wattson.readEventFlagLimitRegisters()

      print("voltageSagLimit = {0}, voltageSurgeLimit = {1}, overCurrentLimit = {2}, overPowerLimit = {3}".format(
            eventFlagLimits.voltageSagLimit, eventFlagLimits.voltageSurgeLimit, eventFlagLimits.overCurrentLimit, eventFlagLimits.overPowerLimit))

      eventFlagLimits.voltageSagLimit = voltageSagLimit
      eventFlagLimits.voltageSurgeLimit = voltageSurgeLimit      
      eventFlagLimits.overCurrentLimit = overCurrentLimit
      eventFlagLimits.overPowerLimit = overPowerLimit
      retVal = wattson.writeEventFlagLimitRegisters(eventFlagLimits);

      eventData = 0

      ## Map Voltage Sag Event to event pin
      eventData = bitSet(eventData, UpbeatLabs_MCP39F521.UpbeatLabs_MCP39F521.Event_config.EVENT_VSAG_PIN.value)
      ## Map Voltage Surge Event to event pin
      eventData = bitSet(eventData, UpbeatLabs_MCP39F521.UpbeatLabs_MCP39F521.Event_config.EVENT_VSURGE_PIN.value)
      ## Map Over Current Event to event pin
      eventData = bitSet(eventData, UpbeatLabs_MCP39F521.UpbeatLabs_MCP39F521.Event_config.EVENT_OVERCUR_PIN.value)
      ## Map Over Power Event to event pin
      eventData = bitSet(eventData, UpbeatLabs_MCP39F521.UpbeatLabs_MCP39F521.Event_config.EVENT_OVERPOW_PIN.value)
  
      print("Event Config Register set to {}".format(eventData));
      
      retVal = wattson.setEventConfigurationRegister(eventData);

def bitSet(value, bit):
    value |= (1 << (bit))
    return value

def bitRead(value, bit):
    return (((value) >> (bit)) & 0x01)

def bitClear(value, bit):
    value &= ~(1 << (bit))
    return value

def bitWrite(value, bit, bitValue):
    return bitSet(value, bit) if bitValue else bitClear(value, bit)


def powerQuadrant(energyData):
    sign_pa = (energyData.systemStatus >> UpbeatLabs_MCP39F521.UpbeatLabs_MCP39F521.System_status.SYSTEM_SIGN_PA.value ) & 0x01

    sign_pr = (energyData.systemStatus >> UpbeatLabs_MCP39F521.UpbeatLabs_MCP39F521.System_status.SYSTEM_SIGN_PR.value ) & 0x01

    quadrant = 0
    if (sign_pa == 1):
        if (sign_pr == 1):
            quadrant = 1
        else:
            quadrant = 4
    else:
        if (sign_pr == 1):
            quadrant = 2
        else:
            quadrant = 3      
    return quadrant if (energyData.activePower >= 1) else 0


def events(energyData):
    events = []
    if (bitRead(energyData.systemStatus, UpbeatLabs_MCP39F521.UpbeatLabs_MCP39F521.System_status.SYSTEM_EVENT.value) == 1):
        if (bitRead(energyData.systemStatus, UpbeatLabs_MCP39F521.UpbeatLabs_MCP39F521.System_status.SYSTEM_VSAG.value) == 1):
            events.append("Voltage Sag")
        if (bitRead(energyData.systemStatus, UpbeatLabs_MCP39F521.UpbeatLabs_MCP39F521.System_status.SYSTEM_VSURGE.value) == 1):
            events.append("Voltage Surge")
        if (bitRead(energyData.systemStatus, UpbeatLabs_MCP39F521.UpbeatLabs_MCP39F521.System_status.SYSTEM_OVERCUR.value) == 1):
            events.append("Over Current")
        if (bitRead(energyData.systemStatus, UpbeatLabs_MCP39F521.UpbeatLabs_MCP39F521.System_status.SYSTEM_OVERPOW.value) == 1):
            events.append("Over Power")
    return events
 

def checkSystemStatus(systemStatus):    
    if (bitRead(systemStatus, UpbeatLabs_MCP39F521.UpbeatLabs_MCP39F521.System_status.SYSTEM_EVENT.value) == 1):
        print("EVENT has occurred!") 
  
    if (bitRead(systemStatus, UpbeatLabs_MCP39F521.UpbeatLabs_MCP39F521.System_status.SYSTEM_VSAG.value) == 1):
        print("Voltage Sag condition") 
  
    if (bitRead(systemStatus, UpbeatLabs_MCP39F521.UpbeatLabs_MCP39F521.System_status.SYSTEM_VSURGE.value) == 1):
        print("Voltage Surge condition") 
  

    if (bitRead(systemStatus, UpbeatLabs_MCP39F521.UpbeatLabs_MCP39F521.System_status.SYSTEM_OVERCUR.value) == 1):
        print("Over Current condition") 
  

    if (bitRead(systemStatus, UpbeatLabs_MCP39F521.UpbeatLabs_MCP39F521.System_status.SYSTEM_OVERPOW.value) == 1):
        print("Over Power condition") 
  
    # The sign of the active/reaction power is also indicated in the system
    # status register. This can tell us in which quadrant our power is.
    # We only want to do this when we have power - i.e when there is a
    # voltage sag, let's ignore this
    if (bitRead(systemStatus, UpbeatLabs_MCP39F521.UpbeatLabs_MCP39F521.System_status.SYSTEM_VSAG.value) == 0):
    
        if (bitRead(systemStatus, UpbeatLabs_MCP39F521.UpbeatLabs_MCP39F521.System_status.SYSTEM_SIGN_PA.value) == 1):
            print("Active Power is positive (import)")
        else:
            print("Active Power is negative (export)")
  

        if (bitRead(systemStatus, UpbeatLabs_MCP39F521.UpbeatLabs_MCP39F521.System_status.SYSTEM_SIGN_PR.value) == 1):
            print("Reactive power is positive, inductive")
        else:
            print("Reactive power is negative, capacitive")


def checkSystemStatusOld(energyData):
    if (energyData.systemStatus >> UpbeatLabs_MCP39F521.UpbeatLabs_MCP39F521.System_status.SYSTEM_SIGN_PA.value ) & 0x01:
        print("SIGN_PA bit is set")

    if (energyData.systemStatus >> UpbeatLabs_MCP39F521.UpbeatLabs_MCP39F521.System_status.SYSTEM_SIGN_PR.value ) & 0x01:
        print("SIGN_PR bit is set")

    if (energyData.systemStatus >> UpbeatLabs_MCP39F521.UpbeatLabs_MCP39F521.System_status.SYSTEM_EVENT.value ) & 0x01:
        print("SYSTEM_EVENT bit is set")

    if (energyData.systemStatus >> UpbeatLabs_MCP39F521.UpbeatLabs_MCP39F521.System_status.SYSTEM_VSAG.value ) & 0x01:
        print("VSAG bit is set")

    if (energyData.systemStatus >> UpbeatLabs_MCP39F521.UpbeatLabs_MCP39F521.System_status.SYSTEM_VSURGE.value ) & 0x01:
        print("VSURGE bit is set")

    if (energyData.systemStatus >> UpbeatLabs_MCP39F521.UpbeatLabs_MCP39F521.System_status.SYSTEM_OVERCUR.value ) & 0x01:
        print("OVERCUR bit is set")

    if (energyData.systemStatus >> UpbeatLabs_MCP39F521.UpbeatLabs_MCP39F521.System_status.SYSTEM_OVERPOW.value ) & 0x01:
        print("OVERPOW bit is set")


def write_measurements(device_id):
    influxdb_client = InfluxDBClient(url=config.get('APP', 'INFLUX_URL'),
                                     token=config.get('APP', 'INFLUX_TOKEN'),
                                     org=config.get('APP', 'INFLUX_ORG'))
    write_api = influxdb_client.write_api(write_options=SYNCHRONOUS)

    (ret, energyData) = wattson.readEnergyData()

    if (ret != UpbeatLabs_MCP39F521.UpbeatLabs_MCP39F521.Error_code.SUCCESS.value):
        print("Error reading energy data: {}".format(ret))

    (retA, energyAccumData) = wattson.readEnergyAccumData()

    if (retA != UpbeatLabs_MCP39F521.UpbeatLabs_MCP39F521.Error_code.SUCCESS.value):
        print("Error reading energy accum data: {}".format(retA))

    if (ret == UpbeatLabs_MCP39F521.UpbeatLabs_MCP39F521.Error_code.SUCCESS.value and retA == UpbeatLabs_MCP39F521.UpbeatLabs_MCP39F521.Error_code.SUCCESS.value):

        pq = powerQuadrant(energyData) 
        now = datetime.now(timezone.utc)

        point = Point("wattson_measurement") \
            .tag("device", device_id) \
            .field("SystemStatus", energyData.systemStatus) \
            .field("PowerQuadrant", pq ) \
            .field("VoltageRMS", energyData.voltageRMS) \
            .field("CurrentRMS", energyData.currentRMS) \
            .field("LineFrequency", energyData.lineFrequency) \
            .field("PowerFactor", energyData.powerFactor) \
            .field("ActivePower", energyData.activePower) \
            .field("ReactivePower", energyData.reactivePower) \
            .field("ApparentPower", energyData.apparentPower) \
            .field("ActiveEnergyImport", energyAccumData.activeEnergyImport) \
            .field("ReactiveEnergyImport", energyAccumData.reactiveEnergyImport) \
            .field("ActiveEnergyExport", energyAccumData.activeEnergyExport) \
            .field("ReactiveEnergyExport", energyAccumData.reactiveEnergyExport) \
            .time(now)

        print(f"Writing: {point.to_line_protocol()}")
        try: 
            client_response = write_api.write(bucket=config.get('APP', 'INFLUX_BUCKET'), record=point)
        except Exception as e:
            print(f"Write operation failed: {e}")

        write_display(energyData)

        checkSystemStatus(energyData.systemStatus)
        myEvents = events(energyData)
        unix_timestamp = int(now.timestamp()*1000)

        return (energyData, energyAccumData, pq, myEvents, unix_timestamp) 

    # Return None on failure
    return None


def energyAccumulationInitialize():
    retVal, accumIntervalReg = wattson.readAccumulationIntervalRegister()
    print("Accumulation interval is {}".format(accumIntervalReg))

    time.sleep(1);

    ## Turn off any previous energy accumulation
    print("Turn off any previous accumulation")
    wattson.enableEnergyAccumulation(False)

    ## Wait for sometime for registers to reset before re-enabling them
    time.sleep(1);
  
    ## Turn on energy accumulation
    print("Re-enable accumulation");
    wattson.enableEnergyAccumulation(True)  


def get_measurements(device_id):
    influxdb_client = InfluxDBClient(url=config.get('APP', 'INFLUX_URL'),
                                     token=config.get('APP', 'INFLUX_TOKEN'),
                                     org=config.get('APP', 'INFLUX_ORG'))

    # Queries must be formatted with single and double quotes correctly
    query_api = QueryApi(influxdb_client)
    device_id = str(device_id)
    device_filter = f'r.device == "{device_id}"'
    flux_query = f'from(bucket: "{config.get("APP", "INFLUX_BUCKET")}") ' \
                 f'|> range(start: 0) ' \
                 f'|> filter(fn: (r) => r._measurement == "environment" and {device_filter}) ' \
                 f'|> last()'

    response = query_api.query(flux_query)

    # iterate through the result(s)
    results = []
    for table in response:
        results.append(table.records[0].values)

    return results

# TODO
# Function should return a response code
# Creates an authorization for a supplied deviceId
def create_authorization(device_id) -> Authorization:
    influxdb_client = InfluxDBClient(url=config.get('APP', 'INFLUX_URL'),
                                     token=config.get('APP', 'INFLUX_TOKEN'),
                                     org=config.get('APP', 'INFLUX_ORG'))

    authorization_api = AuthorizationsApi(influxdb_client)

    buckets_api = BucketsApi(influxdb_client)
    buckets = buckets_api.find_bucket_by_name(config.get('APP', 'INFLUX_BUCKET_AUTH'))  # function returns only 1 bucket
    bucket_id = buckets.id
    org_id = buckets.org_id
    desc_prefix = f'IoTCenterDevice: {device_id}'
    # get bucket_id from bucket
    org_resource = PermissionResource(org_id=config.get('APP', 'INFLUX_ORG'), type="buckets")
    read = Permission(action="read", resource=org_resource)
    write = Permission(action="write", resource=org_resource)
    permissions = [read, write]

    authorization = Authorization(org_id=config.get('APP', 'INFLUX_ORG'),
                                  permissions=permissions,
                                  description=desc_prefix)

    request = authorization_api.create_authorization(org_id=org_id, permissions=permissions)
    return request


