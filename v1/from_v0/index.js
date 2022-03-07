/**
 * This file contains all the content that is provided
 * in 'kana' itself, independent of the version of 
 * the format. In contrast, the 'converter.js' file 
 * contains all and only the code required to convert
 * from version 0 to version 1.
 */

import {convertFromVersion0} from "./converter.js";
import * as pako from "pako";
import * as fs from "fs";
import * as scran from "scran.js";

await scran.initialize({ localFile: true });

function bufferToNumber(buffer) {
    var output = 0;
    var multiplier = 1;
    for (const x of buffer) {
        output += multiplier * x;
        multiplier *= 256;
    }
    return output;
}

let path = "../../v0/examples/zeisel_mtx_20220306.kana";
const data = fs.readFileSync(path);
let buffer = data.buffer;

var offset = 0;
var format = bufferToNumber(new Uint8Array(buffer, offset, 8));
offset += 8;

var version = bufferToNumber(new Uint8Array(buffer, offset, 8));
offset += 8;

var json_len = bufferToNumber(new Uint8Array(buffer, offset, 8));
offset += 8;

var contents = pako.ungzip(new Uint8Array(buffer, offset, json_len), { "to": "string" });
let state = JSON.parse(contents);
convertFromVersion0(state, "updated.h5");

scran.terminate();
