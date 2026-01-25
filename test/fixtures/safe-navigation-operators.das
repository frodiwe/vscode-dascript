// Test fixture for safe navigation operators (?as and ?is)
// These should be highlighted as keywords, not variables

def test_safe_as()
    var x = someValue ?as int
    var y = getValue() ?as CustomType
    let z = obj ?as BaseClass

def test_safe_is()
    if value ?is int
        print("is int")
    let isCustom = obj ?is CustomType

def test_combined()
    // Both operators in the same function
    if item ?is Widget
        let widget = item ?as Widget
        widget.draw()

def test_chained()
    // Chained with regular operators
    var result = container?.item ?as SpecificType
    if result ?is ValidType && result != null
        process(result)
