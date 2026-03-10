// Test file for smart_ptr type highlighting
// TypeDecl and other types inside smart_ptr<> should be highlighted as types

// Function with smart_ptr parameter containing a type
def getBaseCppType(typ : smart_ptr<ast::TypeDecl>&; cpp_type : string; var imports : table<string>&)
    pass

// Variable declaration with smart_ptr
var nodePtr : smart_ptr<ast::TypeDecl>
var exprPtr : smart_ptr<ExprCallMacro>
var declPtr : smart_ptr<TypeDecl>

// Function return type with smart_ptr
def createNode() : smart_ptr<ast::TypeDecl>
    return new ast::TypeDecl

// Multiple smart_ptr parameters
def processNodes(first : smart_ptr<TypeDecl>; second : smart_ptr<ExprNode>)
    pass

// Nested templates
var complexType : table<string; smart_ptr<ast::TypeDecl>>
var arrayType : array<smart_ptr<TypeDecl>>

// smart_ptr in variant
var variantType : variant<node : smart_ptr<TypeDecl>; expr : smart_ptr<ExprNode>>

// smart_ptr with qualified namespace types
def handleAstNode(node : smart_ptr<ast::TypeDecl>; expr : smart_ptr<ast::Expression>)
    pass
