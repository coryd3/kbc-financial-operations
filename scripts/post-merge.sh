#!/bin/bash
set -e

cd app
npm install --no-audit --no-fund
npm run db:push -- --force
