#!/usr/bin/env ucode

let fs = require("fs");

function as_string(value) {
    return value == null ? "" : "" + value;
}

function read_json_file(path) {
    let data = fs.readfile(path);
    if (data == null)
        return null;

    try {
        return json(data);
    }
    catch (e) {
        return null;
    }
}

function read_stdin() {
    let input = fs.open("/dev/stdin", "r");
    if (!input)
        return "";
    let data = input.read("all");
    input.close();
    return data == null ? "" : data;
}

function read_stdin_json() {
    let data = read_stdin();
    try {
        return json(data);
    }
    catch (e) {
        return null;
    }
}

function write_json(value) {
    print(sprintf("%J", value), "\n");
}

function write_compact_string_array(values) {
    print("[");
    for (let i = 0; i < length(values); i++) {
        if (i > 0)
            print(",");
        print(sprintf("%J", as_string(values[i])));
    }
    print("]\n");
}

function csv_to_json_array(value) {
    value = as_string(value);
    write_compact_string_array(value == "" ? [] : split(value, ","));
}

function write_json_file(path, value) {
    return fs.writefile(path, sprintf("%J\n", value));
}

function secure_private_dir(path) {
    path = as_string(path);
    if (path == "")
        return false;

    while (length(path) > 1 && substr(path, length(path) - 1, 1) == "/")
        path = substr(path, 0, length(path) - 1);

    let leaf_stat = fs.lstat(path);
    if (leaf_stat != null && leaf_stat.type != "directory")
        return false;

    if (leaf_stat == null) {
        let is_abs = substr(path, 0, 1) == "/";
        let parts = split(path, "/");
        let cur = is_abs ? "" : ".";
        for (let i = 0; i < length(parts) - 1; i++) {
            let part = parts[i];
            if (part == "" || part == ".")
                continue;
            cur = (cur == "" || cur == ".") ? (is_abs ? "/" + part : part) : (cur + "/" + part);
            let st = fs.stat(cur);
            if (st != null) {
                if (st.type != "directory")
                    return false;
                continue;
            }
            if (!fs.mkdir(cur, 0o700)) {
                let again = fs.stat(cur);
                if (!again || again.type != "directory")
                    return false;
            }
        }
        if (!fs.mkdir(path, 0o700)) {
            let check = fs.lstat(path);
            if (!check || check.type != "directory")
                return false;
        }
    }

    let final_stat = fs.lstat(path);
    if (!final_stat || final_stat.type != "directory")
        return false;
    if (!fs.chmod(path, 0o700))
        return false;
    final_stat = fs.lstat(path);
    return final_stat != null && final_stat.type == "directory" && (final_stat.mode & 0o777) == 0o700;
}

function write_private_json_file(path, value) {
    path = as_string(path);
    if (path == "")
        return false;

    let existing = fs.lstat(path);
    if (existing != null && existing.type != "file")
        return false;

    let slash = rindex(path, "/");
    if (slash > 0) {
        let parent = substr(path, 0, slash);
        let pst = fs.stat(parent);
        if (pst == null) {
            if (!secure_private_dir(parent))
                return false;
        }
        else if (pst.type != "directory") {
            return false;
        }
    }

    let stamp = clock();
    let tmp = sprintf("%s.tmp.%x.%x", path, stamp[0], stamp[1]);
    if (fs.lstat(tmp) != null && !fs.unlink(tmp))
        return false;

    let f = fs.open(tmp, "wex", 0o600);
    if (!f)
        return false;

    fs.chmod(tmp, 0o600);
    let content = sprintf("%J\n", value);
    let written = f.write(content);
    f.flush();
    f.close();

    if (written != length(content) || !fs.chmod(tmp, 0o600) || !fs.rename(tmp, path)) {
        fs.unlink(tmp);
        return false;
    }

    return true;
}

function strip_internal_fields(value) {
    if (type(value) == "array") {
        for (let i = 0; i < length(value); i++)
            value[i] = strip_internal_fields(value[i]);
        return value;
    }

    if (type(value) == "object") {
        for (let key in keys(value)) {
            if (substr(key, 0, 2) == "__") {
                delete value[key];
                continue;
            }
            value[key] = strip_internal_fields(value[key]);
        }
    }

    return value;
}

function array_or_empty(value) {
    return type(value) == "array" ? value : [];
}

function object_or_empty(value) {
    return type(value) == "object" ? value : {};
}

function object_key_count(value) {
    return type(value) == "object" ? length(keys(value)) : 0;
}

function option(section, key, fallback) {
    if (fallback == null)
        fallback = "";
    let value = object_or_empty(section)[key];
    if (value == null)
        return fallback;
    if (type(value) == "array")
        return join(" ", value);
    return as_string(value);
}

function list_option(section, key) {
    let value = object_or_empty(section)[key];
    if (value == null)
        return [];
    if (type(value) == "array")
        return value;
    let text = trim(as_string(value));
    return text == "" ? [] : split(text, " ");
}

function bool_option(section, key, fallback) {
    if (fallback == null)
        fallback = false;
    let value = option(section, key, fallback ? "1" : "0");
    return value == "1" || value == "true" || value == "yes" || value == "on";
}

function int_option(section, key, fallback) {
    let value = option(section, key, fallback);
    if (match(value, /[^0-9]/))
        return int(fallback, 10);
    return int(value, 10);
}

return {
    as_string,
    read_json_file,
    read_stdin,
    read_stdin_json,
    write_json,
    write_compact_string_array,
    csv_to_json_array,
    write_json_file,
    secure_private_dir,
    write_private_json_file,
    strip_internal_fields,
    array_or_empty,
    object_or_empty,
    object_key_count,
    option,
    list_option,
    bool_option,
    int_option
};
