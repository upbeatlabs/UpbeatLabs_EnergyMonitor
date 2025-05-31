from flask import Flask, render_template, jsonify, Response, request
import json
from json import JSONEncoder
import jsonpickle
import random
import time
from datetime import date
import shelve
import schedule
import wattson
from apscheduler.schedulers.background import BackgroundScheduler
import signal 
import threading 
import UpbeatLabs_MCP39F521.UpbeatLabs_MCP39F521 as UpbeatLabs_MCP39F521

energyData = UpbeatLabs_MCP39F521.UpbeatLabs_MCP39F521_Data()
energyAccumData = UpbeatLabs_MCP39F521.UpbeatLabs_MCP39F521_AccumData()
powerQuadrant = 0
now = 0
events = []

data_lock = threading.Lock()

app = Flask(__name__)
scheduler = BackgroundScheduler()

# subclass JSONEncoder
class CustomEncoder(JSONEncoder):
        def default(self, o):
            return o.__dict__

def resetEnergyAccumulation():
    today = date.today()
    with shelve.open('my_db') as db:
        if 'last_run' not in db or db['last_run'] != today:
            print("Resetting Energy Accumulation for the day")
            wattson.energyAccumulationInitialize()
            db['last_run'] = today
        else:
            print("Energy Accumulation has already been reset today.")

def scheduled_task():
    global energyData
    global energyAccumData
    global powerQuadrant
    global now
    global events

    schedule.run_pending()
    result = wattson.write_measurements("wattson01")
    if result is not None:
        with data_lock:
            energyData = result[0]
            energyAccumData = result[1]
            powerQuadrant = result[2]
            events = result[3]
            now = result[4]

@app.route('/')
def index():
    return render_template('wattson.html')

@app.route('/metric')
def metric():
    return render_template('metric.html')

@app.route('/wattson-data')
def wattson_data():
    global energyData
    global energyAccumData
    global powerQuadrant
    global now
    global events

    localED = None
    localEAD = None
    localPQ = 0
    localNow = 0
    localEvents = []

    with data_lock:
       localED = UpbeatLabs_MCP39F521.UpbeatLabs_MCP39F521_Data(energyData.systemStatus, energyData.systemVersion, 
                    energyData.voltageRMS, energyData.lineFrequency, energyData.analogInputVoltage, 
                    energyData.powerFactor, energyData.currentRMS, energyData.activePower, energyData.reactivePower,
                    energyData.apparentPower)
       localEAD = UpbeatLabs_MCP39F521.UpbeatLabs_MCP39F521_AccumData(energyAccumData.activeEnergyImport, 
                    energyAccumData.activeEnergyExport, energyAccumData.reactiveEnergyImport, 
                    energyAccumData.reactiveEnergyExport)
       localPQ = powerQuadrant
       localEvents = events
       localNow = now

    result = { 'energyData': localED, 'energyAccumData': localEAD, 'powerQuadrant': localPQ, 'events': localEvents, 'timestamp':localNow } 
    print(result)
    response = Response(
        response=json.dumps(result, cls=CustomEncoder),
        status=200,
        mimetype='application/json'
    )
    return response
    #return jsonify({'energyData': localEDJSON, 'energyAccumData': localEADJSON})

@app.route('/chart-data')
def chart_data():
    # Generate random data for demonstration
    data = [random.randint(10, 100) for _ in range(7)]
    labels = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    return jsonify({
        'labels': labels,
        'datasets': [{
            'label': 'Live Random Data',
            'backgroundColor': 'rgba(54, 162, 235, 0.2)',
            'borderColor': 'rgba(54, 162, 235, 1)',
            'borderWidth': 1,
            'data': data
        }]
    })

@app.route('/query-data', methods=['GET'])
def query_data():
    device_id = request.args.get('device_id', default='wattson01')
    metric = request.args.get('metric', default='CurrentRMS')
    try:
        result = wattson.query_data(device_id, metric)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    
@app.route('/query-all-data', methods=['GET'])
def query_all_data():
    device_id = request.args.get('device_id', default='wattson01')
    try:
        result = wattson.query_all_data(device_id)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500    


# gracefully exit without a big exception message if possible
def ctrl_c_handler(signal, frame):
    print('Goodbye!')
    wattson.cleanup()
    exit(0)

signal.signal(signal.SIGINT, ctrl_c_handler)

if __name__ == '__main__':
    wattson.initialize()
    wattson.setSystemConfig()
    resetEnergyAccumulation()
    schedule.every().day.at("00:00").do(resetEnergyAccumulation)
    scheduler.add_job(scheduled_task, 'interval', seconds=1)
    scheduler.start()
    app.run(host='0.0.0.0', debug=True, use_reloader=False)


