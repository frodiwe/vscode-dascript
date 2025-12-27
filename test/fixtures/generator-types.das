// Test fixture for generator types with angle brackets

// Generator with type parameters
def test_generator()
    return <- generator<int>() <|
        yield 1
        yield 2
        return false

// Generator with complex type parameters (from user's example)
def test_complex_generator()
    var inscope blk <- qmacro_block <|
        return <- generator<$t(retT)>() <|
            $e(func.body)
            return false

// Multiple generators
def multi_gen()
    var gen1 <- generator<string>() <|
        yield "hello"
        return false
    var gen2 <- generator<float>() <|
        yield 3.14
        return false

// Generator with nested type
def nested_gen()
    return <- generator<array<int>>() <|
        yield [[int 1; 2; 3]]
        return false

// Comparison operators should also work correctly
def test_comparison()
    var a = 5
    var b = 10
    if a < b
        print("a is less than b")
    if b > a
        print("b is greater than a")
    var result = a < b ? "less" : "greater"

// Generic type with comparison
def generic_test()
    var iter <- iterator<int>()
    var tbl : table<string; int>
    var arr : array<float>
    if length(arr) > 0
        print("array has elements")
