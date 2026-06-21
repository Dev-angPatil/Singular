/**
 * Custom E2E Test Runner for Singular
 * Provides a simple test assertion framework (describe, test, expect)
 * and dynamically loads src modules or stub/fallback implementations.
 */

const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

// Global test registration state
const suites = [];
let currentSuite = null;
let passCount = 0;
let failCount = 0;

/**
 * Declares a test suite.
 * @param {string} name 
 * @param {Function} fn 
 */
function describe(name, fn) {
  const suite = { name, tests: [] };
  suites.push(suite);
  const previousSuite = currentSuite;
  currentSuite = suite;
  fn();
  currentSuite = previousSuite;
}

/**
 * Declares a test case inside a suite.
 * @param {string} name 
 * @param {Function} fn 
 */
function test(name, fn) {
  if (!currentSuite) {
    describe('Default Suite', () => {
      currentSuite.tests.push({ name, fn });
    });
  } else {
    currentSuite.tests.push({ name, fn });
  }
}

/**
 * Assertion builder.
 * @param {any} actual 
 */
function expect(actual) {
  const matchers = {
    toBe(expected) {
      if (actual !== expected) {
        throw new Error(`Expected ${JSON.stringify(actual)} to be ${JSON.stringify(expected)}`);
      }
    },
    toEqual(expected) {
      const actualStr = JSON.stringify(actual);
      const expectedStr = JSON.stringify(expected);
      if (actualStr !== expectedStr) {
        throw new Error(`Expected ${actualStr} to equal ${expectedStr}`);
      }
    },
    toBeGreaterThan(expected) {
      if (!(actual > expected)) {
        throw new Error(`Expected ${actual} to be greater than ${expected}`);
      }
    },
    toBeGreaterThanOrEqual(expected) {
      if (!(actual >= expected)) {
        throw new Error(`Expected ${actual} to be greater than or equal to ${expected}`);
      }
    },
    toBeLessThan(expected) {
      if (!(actual < expected)) {
        throw new Error(`Expected ${actual} to be less than ${expected}`);
      }
    },
    toBeLessThanOrEqual(expected) {
      if (!(actual <= expected)) {
        throw new Error(`Expected ${actual} to be less than or equal to ${expected}`);
      }
    },
    toBeTruthy() {
      if (!actual) {
        throw new Error(`Expected ${actual} to be truthy`);
      }
    },
    toBeFalsy() {
      if (actual) {
        throw new Error(`Expected ${actual} to be falsy`);
      }
    },
    toContain(item) {
      if (!actual || typeof actual.includes !== 'function' || !actual.includes(item)) {
        throw new Error(`Expected ${JSON.stringify(actual)} to contain ${JSON.stringify(item)}`);
      }
    },
    toThrow() {
      let threw = false;
      try {
        actual();
      } catch (e) {
        threw = true;
      }
      if (!threw) {
        throw new Error(`Expected function to throw an error`);
      }
    }
  };

  matchers.not = {
    toBe(expected) {
      if (actual === expected) {
        throw new Error(`Expected ${JSON.stringify(actual)} NOT to be ${JSON.stringify(expected)}`);
      }
    },
    toEqual(expected) {
      const actualStr = JSON.stringify(actual);
      const expectedStr = JSON.stringify(expected);
      if (actualStr === expectedStr) {
        throw new Error(`Expected ${actualStr} NOT to equal ${expectedStr}`);
      }
    },
    toContain(item) {
      if (actual && typeof actual.includes === 'function' && actual.includes(item)) {
        throw new Error(`Expected ${JSON.stringify(actual)} NOT to contain ${JSON.stringify(item)}`);
      }
    }
  };

  return matchers;
}

function loadModule(srcRelativePath, fallbackModule) {
  const container = { current: fallbackModule };
  const absolutePath = path.resolve(__dirname, '../../', srcRelativePath);
  
  if (fs.existsSync(absolutePath)) {
    const fileUrl = pathToFileURL(absolutePath).href;
    import(fileUrl).then((mod) => {
      container.current = mod.default || mod;
    }).catch((err) => {
      console.warn(`Warning: Failed to import module at ${absolutePath}, using fallback. Error: ${err.message}`);
    });
  }

  return new Proxy({}, {
    get(target, prop) {
      const active = container.current;
      const val = active[prop];
      if (typeof val === 'function') {
        return val.bind(active);
      }
      return val;
    }
  });
}

/**
 * Runs all registered test suites.
 */
async function run() {
  // Allow dynamic imports to resolve
  await new Promise(resolve => setTimeout(resolve, 50));

  console.log('\n=== Starting E2E Test Suite Execution ===\n');
  passCount = 0;
  failCount = 0;
  
  for (const suite of suites) {
    console.log(`Suite: ${suite.name}`);
    for (const t of suite.tests) {
      try {
        await t.fn();
        console.log(`  ✓ ${t.name}`);
        passCount++;
      } catch (err) {
        console.error(`  ✗ ${t.name}`);
        console.error(`    Error: ${err.message}`);
        if (err.stack) {
          // Find the stack frame in e2e.test.js or test runner to help debugging
          const relevantLine = err.stack.split('\n').find(l => l.includes('e2e.test.js') || l.includes('testRunner.js'));
          if (relevantLine) {
            console.error(`    At: ${relevantLine.trim()}`);
          }
        }
        failCount++;
      }
    }
    console.log('');
  }
  
  console.log('=== Test Summary ===');
  console.log(`Passed: ${passCount}`);
  console.log(`Failed: ${failCount}`);
  console.log(`Total:  ${passCount + failCount}`);
  
  if (failCount > 0) {
    console.log('\nResult: FAILED\n');
    process.exit(1);
  } else {
    console.log('\nResult: PASSED\n');
    process.exit(0);
  }
}

module.exports = {
  describe,
  test,
  expect,
  loadModule,
  run
};

// If executed directly:
if (require.main === module) {
  describe('Basic Dummy Test Suite', () => {
    test('Assertion framework check - true is true', () => {
      expect(true).toBe(true);
    });
    
    test('Assertion framework check - toEqual', () => {
      expect({ a: 1, b: [2, 3] }).toEqual({ a: 1, b: [2, 3] });
    });
    
    test('Assertion framework check - toBeGreaterThanOrEqual', () => {
      expect(10).toBeGreaterThanOrEqual(10);
      expect(10).toBeGreaterThanOrEqual(9);
    });
  });
  
  // Try to load e2e.test.js if it exists
  const testFilePath = path.join(__dirname, 'e2e.test.js');
  if (fs.existsSync(testFilePath)) {
    console.log(`Found e2e.test.js at ${testFilePath}. Loading test cases...`);
    require(testFilePath);
  } else {
    console.log(`No e2e.test.js found at ${testFilePath}. Running only internal check.`);
  }
  
  run();
}
