#!/usr/bin/env npx ts-node
/**
 * Run Prime Scorecard Fixtures
 * 
 * Usage: npx ts-node scripts/run-scorecard-fixtures.ts
 */

import { runAllFixtures } from '../lib/prime-scorecard/__tests__/compute.fixtures'

const passed = runAllFixtures()
process.exit(passed ? 0 : 1)

