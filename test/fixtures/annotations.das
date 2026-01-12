// Test fixture for annotations in daScript

// Structure annotations - appear before struct/class declarations
[match_copy]
struct CmdLocate : Cmd {
    override rtti = "CmdLocate"
    x : float
    y : float
    z : float
}

[match_as_is]
struct DataNode {
    value : int
    next : DataNode?
}

// Property/field annotations in classes
class AnnotationsComponent : Component {
    // Basic export annotations
    @export private export_me : int
    @no_export do_not_export_me : float

    // View and serialize name annotations with string values
    @view_name="Hello, world!"
    @serialize_name=hello_world // string without space do not require quotes
    bye_world : string

    // Hint annotation with quoted string
    @hint="This is a color field"
    @color
    color : float4

    // Collapse annotation
    @collapse
    nested_data : SomeStructure

    // Multiple annotations on single field
    @export
    @view_name="Position"
    @hint="Player position in 3D space"
    position : float3
}

// More field annotations examples
class AbstractGameClient : Component {
    hasLocalServer : bool
    currentScenarioRoundType : ScenarioRoundType
    @no_export localClientMessages : array<OnNetMessageCommand>

    @export
    @view_name="Player Name"
    playerName : string

    @serialize_name=hp
    @view_name="Health Points"
    health : int
}

// Function annotations
[deprecated]
def old_function() {
    pass
}

[cheat]
def foo() {
    pass
}

// Block annotations - appear after block declaration
def queryOne(dt:float=1.0f) {
    testProfile::queryEs() <| $ [es] (var pos:float3&;vel:float3 const) {
        pos += vel * dt
    }
}

// Functions with namespace-qualified types
def parseAst(node : ast::TypeDecl)
    pass

struct CompilerState {
    rootNode : ast::Module
    currentExpr : ast::Expression
    errorCtx : parser::ErrorContext
}

// More structure annotations
[sealed]
class FinalClass {
    value : int
}

// Annotation with arguments in brackets
[some_annotation(arg1, arg2)]
struct AnnotatedStruct {
    field : float
}

// Multiple annotations on structure
[match_copy]
[serializable]
struct MultiAnnotated {
    data : int
}

// Call macro annotations - used for macro definitions
[call_macro(name="yield_from")]
class private YieldFrom : AstCallMacro
    def override visit(prog: ProgramPtr; mod: Module?)
        return true

// Another call macro annotation
[call_macro(name="co_continue")]
class private CoContinue : AstCallMacro
    def override visit(prog: ProgramPtr; mod: Module?)
        return false

// Keyword arguments in annotations
[describe(decl=typ, modules=false)]
struct TypeDescription {
    name : string
    size : int
}

// More keyword arguments in annotations
[export(name="custom_name", version=1)]
class ExportedClass {
    data : float
}

// Function macro annotation
[function_macro]
class TestMacro
    def apply()
        return 1
