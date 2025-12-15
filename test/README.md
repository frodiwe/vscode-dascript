# Test Suite for daScript Syntax Highlighting

This directory contains tests for the daScript VS Code extension syntax highlighting.

## Test Cases

### 1. Optional Type Parameters (`optional-types.das`)
Tests that optional type markers (`?`) don't break highlighting of subsequent parameters.

**Fixed Issue**:
```das
def setMinimapPosition(var self : CombatUI?, playerPosition : float3, cameraRotation: quat4)
```
The `quat4` type was not being highlighted correctly after `CombatUI?`.

### 2. String Interpolation with Ternary Operators (`string-interpolation.das`)
Tests that ternary operators inside strings don't cause the rest of the file to be highlighted as a string.

**Fixed Issue**:
```das
self.ammoValue.text = currentAmount == -1 ? "∞" : "{max(currentAmount, 0)}"
self.clipValue.text = reserveAmount == -1 ? "∞" : "{max(reserveAmount, 0)}"

self.mainWeaponSlot.name.nodeId.isActive = false  // This line was incorrectly highlighted as string
```

### 3. Ternary Operators (`ternary-operators.das`)
Tests that the colon in ternary operators is not incorrectly detected as a type declaration.

**Fixed Issue**:
```das
var result = condition ? trueValue : falseValue
```
The `: falseValue` part was being detected as a variable type declaration.

## Running Tests

```bash
npm install
npm test
```

## Test Structure

- `test/fixtures/` - Test fixture files with daScript code
- `test/suite/` - Test implementations
- `test/runTest.js` - Test runner configuration
