#!/bin/bash
set -e

cd app
npm install --no-audit --no-fund
echo "Dependencies installed. Build the app, then apply checked-in migrations with npm run db:migrate."
