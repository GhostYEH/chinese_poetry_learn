# Poetry Learning System - User Guide

## System Requirements
- Windows 10/11
- No Node.js installation required (Portable Node.js v20.11.0 included)

## How to Use

### Start the System
1. Double-click start.bat
2. Wait 3-5 seconds for server initialization
3. Browser will open automatically at http://localhost:3000

### Stop the System
- Double-click stop.bat
- Or close the command window

## Folder Structure
`
Packaged/
+-- nodejs/          # Portable Node.js (v20.11.0)
+-- backend/         # Backend service
|   +-- db/          # Database files
|   |   +-- poetry.db  # SQLite database (984 poems)
|   +-- cache/       # AI explanation cache
|   +-- public/      # Frontend static files
|   +-- src/         # Backend source code
|   +-- node_modules/ # Dependencies
+-- start.bat        # Start script
+-- stop.bat         # Stop script
+-- README.txt       # This file
`

## Features
- Poetry learning and recitation
- AI intelligent explanation
- Feihualing game
- Challenge battles
- Learning record tracking
- Error book review

## Notes
1. First startup may take a few seconds to initialize database
2. Do not delete or move nodejs and backend folders
3. To migrate to another PC, copy the entire folder
4. Default port is 3000, make sure it's not occupied

## Database Info
- Type: SQLite
- Poems: 984
- Location: backend/db/poetry.db

## Troubleshooting
1. Check if port 3000 is occupied
2. Verify nodejs folder is complete
3. Verify backend folder is complete
