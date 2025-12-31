// Test fixture for function return type annotations

// Function with return type annotation (no parameters)
def extractData : array<uint8>
    return [[auto 1u8; 2u8; 3u8]]

// Function with return type annotation (no parameters, different types)
def getData : string
    return "test"

def getCount : int
    return 42

def isValid : bool
    return true

// Function with parameters and return type
def processData(input : string) : array<int>
    return [[auto 1; 2; 3]]

def calculate(x : float, y : float) : float
    return x + y

// Function with complex return type
def getMapping : table<string; int>
    return [[auto "a" => 1; "b" => 2]]

def getTuple : tuple<int; string; bool>
    return [[auto 1, "test", true]]

// Function with optional return type
def findItem(id : int) : Item?
    return null

// Function with generic/template return type
def createArray : array<float3>
    return [[auto float3(1.0, 2.0, 3.0)]]

// Static function with return type
def static_func : uint64
    return 100ul

// Private function with return type
def private getData2 : string
    return "private"

// Public function with return type
def public getData3 : int
    return 123

// Function with var parameters
def public serialize(var arch : Archive; var value : auto(TT)&)
    return

def public serialize2(var arch : Archive; var value : auto(TT)[])
    return

// Function with no spaces around colons
def public serialize3(var arch:Archive; var value:auto(TT)&)
    return

def processWithVar(var x : int; var y : float) : float
    return x + y

def processNoSpaces(x:int; y:float) : float
    return x + y

// Function with auto types in parameters
def processAuto(data : auto(T); items : auto(U)[])
    return

def withAutoRef(value : auto(TT)&; array : auto(T)[])
    return

// Function with let parameters
def readData(let config : Config; let options : Options)
    return

// Function with mixed parameter modifiers
def update(var mutable : int; let immutable : string; value : float)
    return

// Multiline function with variables after return type
def normalizeAngle(delta: float, ang: float, PI: float, TWO_PI: float) : float
    return abs(delta) > PI ? ang + (delta > 0.f ? 1.f : -1.f) * TWO_PI : ang
