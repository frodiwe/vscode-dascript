// Test file for array indexing syntax highlighting
// Array indexing with brackets should highlight correctly

def test_array_indexing()
    // Simple array indexing
    var items: array<int>
    push(items, 1)
    push(items, 2)
    push(items, 3)
    let first = items[0]
    let last = items[2]

    // Array indexing with variables
    let index = 2
    let value = items[index]

    // Multi-dimensional array indexing
    var matrix: array<array<int>>
    let element = matrix[1][2]

    // Array indexing in expressions
    let sum = items[0] + items[1] + items[2]
    let result = items[index - 1] * 2

    // Array indexing in function calls
    print("First: {items[0]}")
    send_message(items[0], items[1])

    // Array indexing with complex expressions
    let computed = items[index * 2 + 1]
    let nested = items[get_index()]

    // Array indexing in conditionals
    if items[0] > 0
        return items[1]

    let check = items[2] != 0 ? items[2] : items[3]

    // Array indexing with member access
    var objects: array<Object>
    let name = objects[0].name
    let value2 = objects[index].property.field

    // Array indexing in assignments
    items[0] = 100
    items[index] = items[index] + 1
    matrix[1][1] = 42

    // Array indexing with string keys (table-like)
    var table: table<string; int>
    table["key"] = 10
    let val = table["key"]

    // Complex array indexing scenarios
    var arr: array<array<int>>
    let nested_val = arr[0][1]
    arr[get_row()][get_col()] = calculate_value()
