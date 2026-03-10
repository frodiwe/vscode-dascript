// Test fixture for piped function calls

// Simple piped call with parentheses (not block syntax)
def test_piped_with_parens(scene)
    let node_id = scene |> get_node_id("test")
    return node_id

// Piped call in ternary expression
def test_piped_in_ternary(scene, target: string)
    let result = target == "" ? -1 : scene |> get_node_id(target)
    return result

// Complex expression: ternary with piped call, followed by comma
def test_complex_expression(scene, target: string)
    var data <- [[auto
        animchar_node_collapser__targetNode = target == "" ? -1 : scene |> scene_instance_getNodeId(target),
        animchar_node_collapser__otherNode = 42
    ]]
    return data

// Piped call with block syntax (using <|)
def test_piped_block(arr)
    arr |> each <| $(item)
        print("{item}")

// Multiple piped calls in sequence
def test_chained_pipes(scene, name: string)
    let node = scene |> find_node(name) |> get_transform()
    return node

// Piped call at end of line
def test_piped_at_eol(scene)
    scene |> process_all
    return true
