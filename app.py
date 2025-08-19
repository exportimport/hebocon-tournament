#!/usr/bin/env python3
"""
Hebocon Tournament Server
Ein einfacher Flask-Server für die Hebocon-Turnier-Steuerung
"""

from flask import Flask, render_template, request, jsonify, send_from_directory
import json
import os
from datetime import datetime

app = Flask(__name__)

# Daten-Datei
DATA_FILE = 'tournament_data.json'

# Standard-Daten
DEFAULT_DATA = {
    'robots': [
        'Wackel-Bot 3000',
        'Chaos-Maschine', 
        'Sturz-Roboter',
        'Mega-Wackler',
        'Schrott-König',
        'Bumm-Bot',
        'Zitter-Zerstörer',
        'Krach-Kiste',
        'Wums-Wurm',
        'Rüttel-Rex',
        'Kipp-Bot',
        'Vibro-Fighter'
    ],
    'current_match': {
        'robot1': 'Wackel-Bot 3000',
        'robot2': 'Chaos-Maschine',
        'round': 'Viertelfinale'
    },
    'last_updated': datetime.now().isoformat()
}

def load_data():
    """Daten aus JSON-Datei laden"""
    if os.path.exists(DATA_FILE):
        try:
            with open(DATA_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except:
            pass
    return DEFAULT_DATA.copy()

def save_data(data):
    """Daten in JSON-Datei speichern"""
    data['last_updated'] = datetime.now().isoformat()
    with open(DATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

# Routes
@app.route('/')
def control_panel():
    """Steuerungs-Interface"""
    return render_template('control.html')

@app.route('/overlay')
def overlay():
    """OBS Overlay"""
    return render_template('overlay.html')

@app.route('/api/data')
def get_data():
    """Aktuelle Daten als JSON"""
    return jsonify(load_data())

@app.route('/api/robots', methods=['GET', 'POST'])
def handle_robots():
    """Roboter-Liste verwalten"""
    data = load_data()
    
    if request.method == 'POST':
        new_robot = request.json.get('name', '').strip()
        if new_robot and new_robot not in data['robots']:
            data['robots'].append(new_robot)
            save_data(data)
            return jsonify({'success': True, 'message': f'Roboter "{new_robot}" hinzugefügt'})
        return jsonify({'success': False, 'message': 'Roboter bereits vorhanden oder ungültiger Name'})
    
    return jsonify(data['robots'])

@app.route('/api/robots/<robot_name>', methods=['DELETE'])
def delete_robot(robot_name):
    """Roboter löschen"""
    data = load_data()
    if robot_name in data['robots']:
        data['robots'].remove(robot_name)
        save_data(data)
        return jsonify({'success': True, 'message': f'Roboter "{robot_name}" gelöscht'})
    return jsonify({'success': False, 'message': 'Roboter nicht gefunden'})

@app.route('/api/match', methods=['GET', 'POST'])
def handle_match():
    """Aktuelles Match verwalten"""
    data = load_data()
    
    if request.method == 'POST':
        match_data = request.json
        if 'robot1' in match_data:
            data['current_match']['robot1'] = match_data['robot1']
        if 'robot2' in match_data:
            data['current_match']['robot2'] = match_data['robot2']
        if 'round' in match_data:
            data['current_match']['round'] = match_data['round']
        
        save_data(data)
        return jsonify({'success': True, 'match': data['current_match']})
    
    return jsonify(data['current_match'])

@app.route('/api/reset', methods=['POST'])
def reset_data():
    """Alle Daten zurücksetzen"""
    save_data(DEFAULT_DATA.copy())
    return jsonify({'success': True, 'message': 'Daten zurückgesetzt'})

if __name__ == '__main__':
    # Template-Ordner erstellen falls nicht vorhanden
    os.makedirs('templates', exist_ok=True)
    
    print("🤖 Hebocon Tournament Server")
    print("=" * 40)
    print("Steuerung:    http://localhost:5005")
    print("OBS Overlay:  http://localhost:5005/overlay")
    print("API Daten:    http://localhost:5005/api/data")
    print("=" * 40)
    
    app.run(debug=True, host='0.0.0.0', port=5005)
