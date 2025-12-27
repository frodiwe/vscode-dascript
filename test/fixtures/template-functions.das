// Test file for template function syntax highlighting

// Template function with qmacro_block and variable names
def test_template_for()
    return <- qmacro_block <|
        for $i(iname) in $e(call.arguments[0])
            yield $i(iname)

// Template with multiple keywords
def template_with_keywords()
    return <- qmacro_block <|
        if $e(condition)
            while $v(counter) < 10
                let $v(result) = $e(expr)
                return $v(result)

// Another template example
def another_template()
    return <- qmacro_block <|
        let $v(vname) = $e(expr)
        for $i(idx) in range(10)
            $v(result) += $i(idx)
