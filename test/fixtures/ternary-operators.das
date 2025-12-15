// Test fixture for ternary operators
def getTernaryValue(condition: bool, trueValue: int, falseValue: int) : int
    var result = condition ? trueValue : falseValue
    return result

def getStringValue(count: int) : string
    return count == -1 ? "unlimited" : "{count}"
