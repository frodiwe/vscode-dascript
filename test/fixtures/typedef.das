// Single-line typedef
typedef MyInt = int
typedef MyString = string

// Multiline typedef with single type
typedef
    Coroutine = iterator<bool>

// Multiline typedef with multiple types
typedef
    Coroutine = iterator<bool>
    Coroutines = array<Coroutine>

// Multiline typedef with various types
typedef
    Handler = function<void>
    Handlers = array<Handler>
    HandlersTable = table<string; Handler>

// Multiline typedef with complex types
typedef
    GenFunc = generator<int>
    LambdaType = lambda<(x: int): int>
    TupleType = tuple<int; string; bool>

// Mixed whitespace
typedef
    Type1 = int
    Type2=string
    Type3   =   bool
