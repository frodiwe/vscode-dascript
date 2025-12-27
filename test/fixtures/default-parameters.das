// Test fixture for function default parameters

// Function with default string parameter
def public assert_once(expr : bool; message : string = "sdf")
    if expr
        print("Assertion passed: {message}")

// Function with multiple default parameters
def public log_message(level : int = 1; text : string = "default"; verbose : bool = false)
    if verbose
        print("Level {level}: {text}")

// Function with default numeric parameters
def calculate(x : float = 1.0; y : float = 2.0) : float
    return x + y

// Function with mixed default and non-default parameters
def process(name : string; age : int = 18; active : bool = true)
    print("Processing {name}, age {age}, active {active}")
