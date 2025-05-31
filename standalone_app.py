import time
import wattson
import signal
from datetime import date
import shelve
import schedule

def resetEnergyAccumulation():
    today = date.today()
    with shelve.open('my_db') as db:
        if 'last_run' not in db or db['last_run'] != today:
            print("Resetting Energy Accumulation for the day")
            wattson.energyAccumulationInitialize()
            db['last_run'] = today
        else:
            print("Energy Accumulation has already been reset today.")

def main():
    wattson.initialize()
    resetEnergyAccumulation()
    schedule.every().day.at("00:00").do(resetEnergyAccumulation)

    while(True):
        schedule.run_pending()
        wattson.write_measurements("wattson01")
        time.sleep(1)

# gracefully exit without a big exception message if possible
def ctrl_c_handler(signal, frame):
    print('Goodbye!')
    wattson.cleanup()
    exit(0)

signal.signal(signal.SIGINT, ctrl_c_handler)

if __name__ == '__main__':
    main()


