// Test file for auto keyword highlighting

// auto in variant type - the main case from the issue
def public await(var a : iterator<variant<res : auto(T); wait : bool>>) : T
    return deref(a)

// auto in simple function return type
def simple_auto() : auto
    return 5

// auto in template with single parameter
def template_func() : auto(T)
    return [[T "test"]]

// auto in nested template
def nested_auto() : array<auto(T)>
    var arr: array<int>
    return arr

// auto in multiple variant fields
def multi_variant() : variant<value : auto(T); error : string; empty : bool>
    return [[auto value = 42]]

// auto in function parameter
def func_with_auto_param(x : auto(T)) : T
    return x

// auto in lambda type
var lambda_auto = @ <| (x : auto) => x + 1

// auto with multiple template parameters
def multi_template() : auto(T, U)
    return [[T 1, U 2]]

// auto in complex nested structure
def complex_nested() : iterator<variant<
    success : auto(ResultType);
    pending : bool;
    failed : string
>>
    return yield success = [[ResultType 0]]
