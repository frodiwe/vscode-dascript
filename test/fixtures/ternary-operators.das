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

// Ternary with piped function call - should not break highlighting
def test_ternary_with_piped(scene, target: string)
    let animchar_node_collapser__targetNode = target == "" ? -1 : scene |> scene_instance_getNodeId(target)
    return animchar_node_collapser__targetNode

// Ternary with piped call followed by comma (in array/tuple context)
def test_ternary_piped_comma(scene, target: string)
    var data <- [[auto
        targetNode = target == "" ? -1 : scene |> scene_instance_getNodeId(target),
        otherValue = 42
    ]]
    return data
