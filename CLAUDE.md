# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Hebocon Tournament Server - a Python Flask web application for managing robot tournament displays. The system provides a live control panel and OBS overlay for broadcasting robot competitions.

## Development Commands

### Running the Application
```bash
# Activate virtual environment
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run the development server
python3 app.py
```

The server runs on `http://localhost:5005` with these endpoints:
- `/` - Control panel interface
- `/overlay` - OBS streaming overlay
- `/api/data` - Tournament data API

### Environment Setup
```bash
# Create virtual environment (if needed)
python3 -m venv venv

# Activate virtual environment
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

## Architecture

### Core Components
- **app.py**: Main Flask server with REST API endpoints for robot and match management
- **tournament_data.json**: Persistent storage for robots list and current match state
- **templates/control.html**: Interactive control panel for tournament management
- **templates/overlay.html**: Broadcast overlay for OBS with real-time updates

### API Structure
- `GET/POST /api/robots` - Manage robot list (add/list robots)
- `DELETE /api/robots/<name>` - Remove robots
- `GET/POST /api/match` - Manage current match (robots and round)
- `GET /api/data` - Get all tournament data
- `POST /api/reset` - Reset to default state

### Data Flow
1. Control panel sends updates via REST API to Flask server
2. Server persists data in tournament_data.json
3. Overlay polls /api/data every 2 seconds for live updates
4. All changes are immediately reflected in the broadcast overlay

### Frontend Features
- Real-time robot selection and match setup
- Tournament round management (Vorrunde, Viertelfinale, Halbfinale, etc.)
- Auto-refresh every 5 seconds on control panel
- Keyboard shortcuts (1/2 for robot slots, F5 for refresh)
- Responsive design for different screen sizes

The system is designed for live tournament broadcasting with minimal latency between control actions and overlay updates.