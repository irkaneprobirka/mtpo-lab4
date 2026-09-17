"""Папка приложения и команды трёх раннеров."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
COMMANDS = {
    "Jest": ["node_modules/jest/bin/jest.js", "--runInBand", "--ci"],
    "Mocha": ["node_modules/mocha/bin/mocha.js", "tests/mocha/*.test.js"],
    "Vitest": ["node_modules/vitest/vitest.mjs", "run"],
}
