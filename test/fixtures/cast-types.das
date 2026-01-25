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

// Module-qualified types (namespace::Type)
// The module namespace should be highlighted as a type, not a variable
def test_module_qualified_types()
    var decl = reinterpret<ast::TypeDecl?> typ.get_ptr()
    var expr = cast<ast::Expression> value
    var node = upcast<math::Vector3> position

// Variable declarations with module-qualified types
def test_module_qualified_declarations()
    var td : ast::TypeDecl
    let expr : ast::Expression?
    var vec : math::Vector3 = getVector()

// smart_ptr with module-qualified types (template context)
def getCppType(typ : smart_ptr<ast::TypeDecl>&, var imports : table<string>&)
    pass
