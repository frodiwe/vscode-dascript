// Test fixture for function pointer types

// Basic function pointer with parameter type
threshold : function<(nodeId : NodeId) : float>

// Multiple parameters
callback : function<(first : FirstType, second : SecondType) : bool>

// Complex nested types
handler : function<(data : array<int>, config : Config?) : void>

// Function pointer in struct
struct MyStruct
    onEvent : function<(eventId : EventId) : void>
    calculate : function<(value : float) : float>
