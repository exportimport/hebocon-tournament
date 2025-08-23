#!/usr/bin/env python3
"""
Hebocon Tournament Server
Ein einfacher Flask-Server für die Hebocon-Turnier-Steuerung
"""

from flask import Flask, render_template, request, jsonify, send_from_directory
import json
import os
import uuid
from datetime import datetime
import time

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
    'bracket': {
        'tournament_id': None,
        'status': 'not_setup',
        'current_round': 'round1',
        'current_match_id': None,
        'matches': {},
        'bracket_positions': {}
    },
    'overlay_settings': {
        'display_mode': 'match'  # 'match' or 'bracket'
    },
    'tournament_settings': {
        'title': 'HEBOCON 2025'
    },
    'timer': {
        'duration': 180,  # seconds (3 minutes default)
        'start_time': None,
        'elapsed_time': 0,  # time already elapsed when paused
        'is_running': False,
        'is_paused': False
    },
    'winner_animation': {
        'winner': None,  # 'robot1' or 'robot2'
        'animation_state': 'normal',  # 'normal', 'winner_announced', 'celebrating'
        'animation_timestamp': None
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

def create_empty_bracket():
    """Create empty 16-participant tournament bracket"""
    bracket = {
        'tournament_id': str(uuid.uuid4()),
        'status': 'setup',
        'current_round': 'round1',
        'current_match_id': None,
        'matches': {},
        'bracket_positions': {}
    }
    
    # Round 1: 8 matches (16 → 8)
    for i in range(1, 9):
        bracket['matches'][f'r1_m{i}'] = {
            'robot1': 'TBD',
            'robot2': 'TBD',
            'winner': None,
            'completed': False,
            'round': 'round1'
        }
    
    # Quarterfinals: 4 matches (8 → 4)
    bracket['matches']['qf_m1'] = {'robot1': 'winner_r1_m1', 'robot2': 'winner_r1_m2', 'winner': None, 'completed': False, 'round': 'quarterfinals'}
    bracket['matches']['qf_m2'] = {'robot1': 'winner_r1_m3', 'robot2': 'winner_r1_m4', 'winner': None, 'completed': False, 'round': 'quarterfinals'}
    bracket['matches']['qf_m3'] = {'robot1': 'winner_r1_m5', 'robot2': 'winner_r1_m6', 'winner': None, 'completed': False, 'round': 'quarterfinals'}
    bracket['matches']['qf_m4'] = {'robot1': 'winner_r1_m7', 'robot2': 'winner_r1_m8', 'winner': None, 'completed': False, 'round': 'quarterfinals'}
    
    # Semifinals: 2 matches (4 → 2)
    bracket['matches']['sf_m1'] = {'robot1': 'winner_qf_m1', 'robot2': 'winner_qf_m2', 'winner': None, 'completed': False, 'round': 'semifinals'}
    bracket['matches']['sf_m2'] = {'robot1': 'winner_qf_m3', 'robot2': 'winner_qf_m4', 'winner': None, 'completed': False, 'round': 'semifinals'}
    
    # Finals: 1 match (2 → 1)
    bracket['matches']['final'] = {'robot1': 'winner_sf_m1', 'robot2': 'winner_sf_m2', 'winner': None, 'completed': False, 'round': 'finals'}
    
    # Initialize bracket positions (1-16)
    for i in range(1, 17):
        bracket['bracket_positions'][f'pos_{i}'] = 'TBD'
    
    return bracket

def assign_robots_to_bracket(bracket, robots, random_assignment=False):
    """Assign robots to bracket starting positions"""
    import random as rand
    
    if len(robots) < 16:
        return False, f"Need exactly 16 robots, got {len(robots)}"
    
    selected_robots = robots[:16]
    if random_assignment:
        rand.shuffle(selected_robots)
    
    # Assign to bracket positions
    for i, robot in enumerate(selected_robots, 1):
        bracket['bracket_positions'][f'pos_{i}'] = robot
    
    # Assign to first round matches
    for i in range(1, 9):
        pos1 = (i - 1) * 2 + 1
        pos2 = pos1 + 1
        bracket['matches'][f'r1_m{i}']['robot1'] = bracket['bracket_positions'][f'pos_{pos1}']
        bracket['matches'][f'r1_m{i}']['robot2'] = bracket['bracket_positions'][f'pos_{pos2}']
    
    # Don't automatically change status - user controls when tournament starts
    return True, "Robots assigned successfully"

def advance_winner(bracket, match_id, winner):
    """Advance winner to next round"""
    if match_id not in bracket['matches']:
        return False, "Match not found"
    
    match = bracket['matches'][match_id]
    if match['completed']:
        return False, "Match already completed"
    
    if winner not in [match['robot1'], match['robot2']]:
        return False, "Winner must be one of the match participants"
    
    # Set winner and mark as completed
    match['winner'] = winner
    match['completed'] = True
    
    # Update dependent matches
    _update_dependent_matches(bracket, match_id, winner)
    
    return True, "Winner advanced successfully"

def _update_dependent_matches(bracket, completed_match_id, winner):
    """Update matches that depend on this match result"""
    # Map match dependencies
    dependencies = {
        'r1_m1': [('qf_m1', 'robot1')], 'r1_m2': [('qf_m1', 'robot2')],
        'r1_m3': [('qf_m2', 'robot1')], 'r1_m4': [('qf_m2', 'robot2')],
        'r1_m5': [('qf_m3', 'robot1')], 'r1_m6': [('qf_m3', 'robot2')],
        'r1_m7': [('qf_m4', 'robot1')], 'r1_m8': [('qf_m4', 'robot2')],
        'qf_m1': [('sf_m1', 'robot1')], 'qf_m2': [('sf_m1', 'robot2')],
        'qf_m3': [('sf_m2', 'robot1')], 'qf_m4': [('sf_m2', 'robot2')],
        'sf_m1': [('final', 'robot1')], 'sf_m2': [('final', 'robot2')]
    }
    
    if completed_match_id in dependencies:
        for next_match_id, robot_slot in dependencies[completed_match_id]:
            if next_match_id in bracket['matches']:
                bracket['matches'][next_match_id][robot_slot] = winner

def undo_match_result(bracket, match_id):
    """Undo match result and remove winner from dependent matches"""
    if match_id not in bracket['matches']:
        return False, "Match not found"
    
    match = bracket['matches'][match_id]
    if not match['completed']:
        return False, "Match is not completed yet"
    
    # Check if any dependent matches have been completed
    # If so, they need to be undone first
    dependencies = {
        'r1_m1': [('qf_m1', 'robot1')], 'r1_m2': [('qf_m1', 'robot2')],
        'r1_m3': [('qf_m2', 'robot1')], 'r1_m4': [('qf_m2', 'robot2')],
        'r1_m5': [('qf_m3', 'robot1')], 'r1_m6': [('qf_m3', 'robot2')],
        'r1_m7': [('qf_m4', 'robot1')], 'r1_m8': [('qf_m4', 'robot2')],
        'qf_m1': [('sf_m1', 'robot1')], 'qf_m2': [('sf_m1', 'robot2')],
        'qf_m3': [('sf_m2', 'robot1')], 'qf_m4': [('sf_m2', 'robot2')],
        'sf_m1': [('final', 'robot1')], 'sf_m2': [('final', 'robot2')]
    }
    
    # Check if there are completed dependent matches
    dependent_completed = []
    if match_id in dependencies:
        for next_match_id, robot_slot in dependencies[match_id]:
            if next_match_id in bracket['matches'] and bracket['matches'][next_match_id]['completed']:
                dependent_completed.append(next_match_id)
    
    if dependent_completed:
        return False, f"Cannot undo: dependent matches {', '.join(dependent_completed)} must be undone first"
    
    # Store the winner before clearing
    winner = match['winner']
    
    # Undo the match
    match['winner'] = None
    match['completed'] = False
    
    # Remove winner from dependent matches
    if match_id in dependencies:
        for next_match_id, robot_slot in dependencies[match_id]:
            if next_match_id in bracket['matches']:
                # Reset to placeholder for winner references
                bracket['matches'][next_match_id][robot_slot] = f'winner_{match_id}'
    
    return True, f"Match {match_id} result undone successfully"

def get_next_match(bracket):
    """Get the next uncompleted match in bracket order"""
    match_order = [
        'r1_m1', 'r1_m2', 'r1_m3', 'r1_m4', 'r1_m5', 'r1_m6', 'r1_m7', 'r1_m8',
        'qf_m1', 'qf_m2', 'qf_m3', 'qf_m4',
        'sf_m1', 'sf_m2',
        'final'
    ]
    
    for match_id in match_order:
        if match_id in bracket['matches']:
            match = bracket['matches'][match_id]
            if not match['completed'] and match['robot1'] != 'TBD' and match['robot2'] != 'TBD' and 'winner_' not in match['robot1'] and 'winner_' not in match['robot2']:
                return match_id, match
    
    return None, None

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
    data = load_data()
    
    # Auto-reset winner animation after 8 seconds
    if ('winner_animation' in data and 
        data['winner_animation']['animation_state'] == 'winner_announced' and
        data['winner_animation']['animation_timestamp']):
        
        current_time = time.time()
        animation_time = data['winner_animation']['animation_timestamp']
        
        # If more than 8 seconds have passed, reset the animation
        if current_time - animation_time >= 8:
            data['winner_animation']['winner'] = None
            data['winner_animation']['animation_state'] = 'normal'
            data['winner_animation']['animation_timestamp'] = None
            save_data(data)
    
    return jsonify(data)

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

# Bracket API Endpoints
@app.route('/api/bracket', methods=['GET'])
def get_bracket():
    """Get complete tournament bracket"""
    data = load_data()
    return jsonify(data.get('bracket', {}))

@app.route('/api/bracket/setup', methods=['POST'])
def setup_bracket():
    """Create new tournament bracket and assign robots"""
    data = load_data()
    request_data = request.json or {}
    
    # Create empty bracket
    bracket = create_empty_bracket()
    
    # Assign robots if provided
    if 'robots' in request_data:
        robots = request_data['robots']
        random_assignment = request_data.get('random', False)
        success, message = assign_robots_to_bracket(bracket, robots, random_assignment)
        if not success:
            return jsonify({'success': False, 'message': message})
    
    # Save bracket
    data['bracket'] = bracket
    save_data(data)
    
    return jsonify({'success': True, 'message': 'Tournament bracket created', 'bracket': bracket})

@app.route('/api/bracket/match/<match_id>', methods=['POST'])
def update_match_result(match_id):
    """Set match result and advance winner"""
    data = load_data()
    request_data = request.json or {}
    
    if 'bracket' not in data:
        return jsonify({'success': False, 'message': 'No tournament bracket found'})
    
    winner = request_data.get('winner')
    if not winner:
        return jsonify({'success': False, 'message': 'Winner required'})
    
    bracket = data['bracket']
    success, message = advance_winner(bracket, match_id, winner)
    
    if success:
        # Update current match in legacy format for overlay compatibility
        if match_id in bracket['matches']:
            match = bracket['matches'][match_id]
            data['current_match'] = {
                'robot1': match['robot1'],
                'robot2': match['robot2'],
                'round': match['round']
            }
        
        save_data(data)
        return jsonify({'success': True, 'message': message, 'bracket': bracket})
    else:
        return jsonify({'success': False, 'message': message})

@app.route('/api/bracket/match/<match_id>/undo', methods=['POST'])
def undo_match_result_endpoint(match_id):
    """Undo match result and remove winner from dependent matches"""
    data = load_data()
    
    if 'bracket' not in data:
        return jsonify({'success': False, 'message': 'No tournament bracket found'})
    
    bracket = data['bracket']
    success, message = undo_match_result(bracket, match_id)
    
    if success:
        save_data(data)
        return jsonify({'success': True, 'message': message, 'bracket': bracket})
    else:
        return jsonify({'success': False, 'message': message})

@app.route('/api/bracket/current', methods=['GET', 'POST'])
def bracket_current_match():
    """Get/set current bracket match"""
    data = load_data()
    
    if 'bracket' not in data:
        return jsonify({'success': False, 'message': 'No tournament bracket found'})
    
    bracket = data['bracket']
    
    if request.method == 'POST':
        request_data = request.json or {}
        match_id = request_data.get('match_id')
        
        if match_id and match_id in bracket['matches']:
            bracket['current_match_id'] = match_id
            match = bracket['matches'][match_id]
            
            # Update current match for overlay compatibility
            data['current_match'] = {
                'robot1': match['robot1'],
                'robot2': match['robot2'],
                'round': match['round']
            }
            
            save_data(data)
            return jsonify({'success': True, 'current_match_id': match_id, 'match': match})
        else:
            return jsonify({'success': False, 'message': 'Invalid match ID'})
    else:
        # GET - return current match or suggest next match
        current_match_id = bracket.get('current_match_id')
        if current_match_id and current_match_id in bracket['matches']:
            return jsonify({
                'current_match_id': current_match_id,
                'match': bracket['matches'][current_match_id]
            })
        else:
            # Suggest next available match
            next_match_id, next_match = get_next_match(bracket)
            if next_match_id:
                return jsonify({
                    'suggested_match_id': next_match_id,
                    'match': next_match
                })
            else:
                return jsonify({'message': 'No available matches'})

@app.route('/api/bracket/assign', methods=['POST'])
def assign_robot_to_position():
    """Assign a robot to a specific bracket position"""
    data = load_data()
    request_data = request.json or {}
    
    if 'bracket' not in data:
        return jsonify({'success': False, 'message': 'No tournament bracket found'})
    
    position = request_data.get('position')  # e.g., "pos_1"
    robot = request_data.get('robot')
    
    if not position or not robot:
        return jsonify({'success': False, 'message': 'Position and robot required'})
    
    if position not in [f'pos_{i}' for i in range(1, 17)]:
        return jsonify({'success': False, 'message': 'Invalid position'})
    
    if robot not in data.get('robots', []):
        return jsonify({'success': False, 'message': 'Robot not found'})
    
    bracket = data['bracket']
    
    # Check if robot is already assigned to another position
    for pos, assigned_robot in bracket.get('bracket_positions', {}).items():
        if assigned_robot == robot and pos != position:
            bracket['bracket_positions'][pos] = 'TBD'  # Clear previous assignment
    
    # Assign robot to position
    if 'bracket_positions' not in bracket:
        bracket['bracket_positions'] = {}
    
    bracket['bracket_positions'][position] = robot
    
    # Update first round matches if all positions in a match are filled
    _update_first_round_matches(bracket)
    
    save_data(data)
    return jsonify({'success': True, 'message': f'{robot} assigned to {position}', 'bracket': bracket})

def _update_first_round_matches(bracket):
    """Update first round matches based on bracket positions"""
    if 'matches' not in bracket:
        bracket['matches'] = {}
    
    # Ensure all first round matches exist
    for i in range(1, 9):
        match_id = f'r1_m{i}'
        if match_id not in bracket['matches']:
            bracket['matches'][match_id] = {
                'robot1': 'TBD',
                'robot2': 'TBD',
                'winner': None,
                'completed': False,
                'round': 'round1'
            }
    
    # Update matches based on bracket positions
    for i in range(1, 9):
        pos1 = (i - 1) * 2 + 1
        pos2 = pos1 + 1
        match_id = f'r1_m{i}'
        
        robot1 = bracket['bracket_positions'].get(f'pos_{pos1}', 'TBD')
        robot2 = bracket['bracket_positions'].get(f'pos_{pos2}', 'TBD')
        
        bracket['matches'][match_id]['robot1'] = robot1
        bracket['matches'][match_id]['robot2'] = robot2
    
    # Don't automatically change status - let user control when to start tournament
    # The status will only change when user clicks "Start Tournament" or via the API

@app.route('/api/bracket/start', methods=['POST'])
def start_tournament():
    """Start the tournament (change status from setup to running)"""
    data = load_data()
    
    if 'bracket' not in data:
        return jsonify({'success': False, 'message': 'No tournament bracket found'})
    
    bracket = data['bracket']
    
    if bracket.get('status') != 'setup':
        return jsonify({'success': False, 'message': 'Tournament can only be started from setup status'})
    
    # Check if all positions are filled
    all_assigned = all(
        bracket['bracket_positions'].get(f'pos_{i}', 'TBD') != 'TBD'
        for i in range(1, 17)
    )
    
    if not all_assigned:
        return jsonify({'success': False, 'message': 'All 16 positions must be filled before starting tournament'})
    
    # Start the tournament
    bracket['status'] = 'running'
    save_data(data)
    
    return jsonify({'success': True, 'message': 'Tournament started!', 'bracket': bracket})

@app.route('/api/overlay/mode', methods=['GET', 'POST'])
def overlay_display_mode():
    """Get/set overlay display mode"""
    data = load_data()
    
    if 'overlay_settings' not in data:
        data['overlay_settings'] = {'display_mode': 'match'}
    
    if request.method == 'POST':
        request_data = request.json or {}
        mode = request_data.get('mode')
        
        if mode in ['match', 'bracket']:
            data['overlay_settings']['display_mode'] = mode
            save_data(data)
            return jsonify({'success': True, 'mode': mode})
        else:
            return jsonify({'success': False, 'message': 'Invalid mode. Use "match" or "bracket"'})
    
    return jsonify({'mode': data['overlay_settings'].get('display_mode', 'match')})

@app.route('/api/bracket/reset', methods=['POST'])
def reset_bracket():
    """Reset tournament bracket"""
    data = load_data()
    data['bracket'] = {
        'tournament_id': None,
        'status': 'not_setup',
        'current_round': 'round1',
        'current_match_id': None,
        'matches': {},
        'bracket_positions': {}
    }
    save_data(data)
    return jsonify({'success': True, 'message': 'Tournament bracket reset'})

# Timer API Endpoints
@app.route('/api/timer', methods=['GET', 'POST'])
def handle_timer():
    """Get/set timer state"""
    data = load_data()
    
    if 'timer' not in data:
        data['timer'] = {
            'duration': 180,
            'start_time': None,
            'elapsed_time': 0,
            'is_running': False,
            'is_paused': False
        }
    
    # Ensure elapsed_time exists for existing timers
    if 'elapsed_time' not in data['timer']:
        data['timer']['elapsed_time'] = 0
    
    if request.method == 'POST':
        request_data = request.json or {}
        
        if 'duration' in request_data:
            data['timer']['duration'] = int(request_data['duration'])
        
        if 'action' in request_data:
            action = request_data['action']
            
            if action == 'start':
                if data['timer']['is_paused']:
                    # Resume from pause - restart timer with remaining time
                    data['timer']['start_time'] = time.time()
                else:
                    # Fresh start
                    data['timer']['start_time'] = time.time()
                    data['timer']['elapsed_time'] = 0
                data['timer']['is_running'] = True
                data['timer']['is_paused'] = False
            elif action == 'stop':
                data['timer']['start_time'] = None
                data['timer']['elapsed_time'] = 0
                data['timer']['is_running'] = False
                data['timer']['is_paused'] = False
            elif action == 'pause':
                if data['timer']['is_running'] and data['timer']['start_time']:
                    # Calculate elapsed time up to now
                    current_elapsed = time.time() - data['timer']['start_time']
                    data['timer']['elapsed_time'] += current_elapsed
                data['timer']['is_paused'] = True
                data['timer']['is_running'] = False
                data['timer']['start_time'] = None
            elif action == 'reset':
                data['timer']['start_time'] = None
                data['timer']['elapsed_time'] = 0
                data['timer']['is_running'] = False
                data['timer']['is_paused'] = False
        
        save_data(data)
        return jsonify({'success': True, 'timer': get_timer_status(data['timer'])})
    
    return jsonify(get_timer_status(data['timer']))

# Winner Animation API Endpoints
@app.route('/api/winner', methods=['POST'])
def set_winner():
    """Set match winner and trigger animation"""
    data = load_data()
    request_data = request.json or {}
    
    winner_robot = request_data.get('winner')  # 'robot1' or 'robot2'
    
    if winner_robot not in ['robot1', 'robot2']:
        return jsonify({'success': False, 'message': 'Invalid winner. Must be robot1 or robot2'})
    
    # Ensure winner_animation exists
    if 'winner_animation' not in data:
        data['winner_animation'] = {
            'winner': None,
            'animation_state': 'normal',
            'animation_timestamp': None
        }
    
    # Update winner animation data
    data['winner_animation']['winner'] = winner_robot
    data['winner_animation']['animation_state'] = 'winner_announced'
    data['winner_animation']['animation_timestamp'] = time.time()
    
    save_data(data)
    return jsonify({
        'success': True, 
        'winner': winner_robot,
        'animation_state': 'winner_announced'
    })

@app.route('/api/winner/reset', methods=['POST'])
def reset_winner_animation():
    """Reset winner animation state"""
    data = load_data()
    
    # Ensure winner_animation exists
    if 'winner_animation' not in data:
        data['winner_animation'] = {
            'winner': None,
            'animation_state': 'normal',
            'animation_timestamp': None
        }
    else:
        data['winner_animation']['winner'] = None
        data['winner_animation']['animation_state'] = 'normal'
        data['winner_animation']['animation_timestamp'] = None
    
    save_data(data)
    return jsonify({'success': True})

@app.route('/api/tournament/title', methods=['GET', 'POST'])
def handle_tournament_title():
    """Get/set tournament title"""
    data = load_data()
    
    # Ensure tournament_settings exists
    if 'tournament_settings' not in data:
        data['tournament_settings'] = {'title': 'HEBOCON 2025'}
    
    if request.method == 'POST':
        request_data = request.json or {}
        title = request_data.get('title', '').strip()
        
        if not title:
            return jsonify({'success': False, 'message': 'Title cannot be empty'})
        
        if len(title) > 50:
            return jsonify({'success': False, 'message': 'Title too long (max 50 characters)'})
        
        data['tournament_settings']['title'] = title
        save_data(data)
        return jsonify({'success': True, 'title': title})
    
    return jsonify({'title': data['tournament_settings'].get('title', 'HEBOCON 2025')})

def get_timer_status(timer_data):
    """Calculate current timer status"""
    current_time = time.time()
    
    # Ensure elapsed_time exists for backward compatibility
    if 'elapsed_time' not in timer_data:
        timer_data['elapsed_time'] = 0
    
    if timer_data['is_running'] and timer_data['start_time']:
        # Timer is running - calculate total elapsed time
        current_session_elapsed = current_time - timer_data['start_time']
        total_elapsed = timer_data['elapsed_time'] + current_session_elapsed
        remaining = max(0, timer_data['duration'] - total_elapsed)
    elif timer_data['is_paused']:
        # Timer is paused - use stored elapsed time
        remaining = max(0, timer_data['duration'] - timer_data['elapsed_time'])
    else:
        # Timer is stopped/reset
        remaining = timer_data['duration']
    
    minutes = int(remaining // 60)
    seconds = int(remaining % 60)
    
    return {
        'duration': timer_data['duration'],
        'remaining': remaining,
        'remaining_formatted': f"{minutes:02d}:{seconds:02d}",
        'is_running': timer_data['is_running'],
        'is_paused': timer_data['is_paused'],
        'start_time': timer_data['start_time'],
        'elapsed_time': timer_data['elapsed_time']
    }

if __name__ == '__main__':
    # Template-Ordner erstellen falls nicht vorhanden
    os.makedirs('templates', exist_ok=True)
    
    print("Hebocon Tournament Server")
    print("=" * 40)
    print("Steuerung:    http://localhost:5005")
    print("OBS Overlay:  http://localhost:5005/overlay")
    print("API Daten:    http://localhost:5005/api/data")
    print("=" * 40)
    
    app.run(debug=True, host='0.0.0.0', port=5005)
