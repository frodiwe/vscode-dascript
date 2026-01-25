// Test fixture for cast and reinterpret type highlighting
// Types inside angle brackets should be highlighted as types

def test_reinterpret()
    var ptr = reinterpret<int?> somePointer
    var typed = reinterpret<TypeDecl?> typ.get_ptr()
    clear(unsafe(reinterpret<TypeDecl?> typ.get_ptr()).dim)

def test_cast()
    var x = cast<float> intValue
    var y = cast<CustomType> value

def test_upcast()
    var base = upcast<BaseClass> derived

// Reinterpret with built-in types
def test_builtin_reinterpret()
    var f = reinterpret<float> bits
    var i = reinterpret<int> floatBits
    var ptr = reinterpret<uint64> address

// Complex nested expressions with reinterpret
def complexExpression(typ : smart_ptr<TypeDecl>)
    clear(unsafe(reinterpret<TypeDecl?> typ.get_ptr()).dim)
    let result = reinterpret<SomeType?> getValue()
