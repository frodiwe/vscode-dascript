// Test fixture for ternary operators
def getTernaryValue(condition: bool, trueValue: int, falseValue: int) : int
    var result = condition ? trueValue : falseValue
    return result

def getStringValue(count: int) : string
    return count == -1 ? "unlimited" : "{count}"

// Nested ternary operators
def normalizeAngle(delta: float, ang: float, PI: float, TWO_PI: float) : float
    return abs(delta) > PI ? ang + (delta > 0.f ? 1.f : -1.f) * TWO_PI : ang

// Complex nested ternary with function calls
def getStatus(value: int, max: int) : string
    return value < 0 ? "invalid" : value > max ? "overflow" : "{value}"

// Ternary with piped function call (regression test for unhighlighting issue)
def testPipedInTernary(scene, target: string) : int
    var nodeId = target == "" ? -1 : *scene |> scene_instance_getNodeId(target)
    return nodeId

// Multiple piped calls after ternary should also highlight correctly
def testMultiplePiped(a, b, useFirst: bool) : string
    var result = useFirst ? a : b
    return result |> to_string()
