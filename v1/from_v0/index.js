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

function numberToBuffer(number) {
    // Store as little-endian. Probably safer
    // than trying to cast it from a Uint64Array;
    // not sure that endianness is strictly defined.
    var output = new Uint8Array(8);

    var i = 0;
    while (number > 0) {
        output[i] = number % 256;
        number = Math.floor(number / 256);
        i++;
    }

    return output;
}

/*** Reading the current state ***/

let args = process.argv;
let path = args[args.length - 1];
const data = fs.readFileSync(path);
let buffer = data.buffer;

var offset = 0;
var format = bufferToNumber(new Uint8Array(buffer, offset, 8));
offset += 8;

var version = bufferToNumber(new Uint8Array(buffer, offset, 8));
offset += 8;

var json_len = bufferToNumber(new Uint8Array(buffer, offset, 8));
offset += 8;

/*** Unpacking and converting ***/

var contents = pako.ungzip(new Uint8Array(buffer, offset, json_len), { "to": "string" });
let state = JSON.parse(contents);

const newpath = "updated.h5";
convertFromVersion0(state, newpath);

/*** Reassembling the state ***/

const newstate = fs.readFileSync(newpath);
let newbuffer = new Uint8Array(newstate.buffer);

{
    let full = buffer.byteLength;
    let start = 24 + json_len;
    let remaining = new Uint8Array(buffer, start, full - start);

    var combined = new ArrayBuffer(24 + newbuffer.length + remaining.length);
    var combined_arr = new Uint8Array(combined);
    let offset = 0;

    let format_buf = numberToBuffer(format);
    combined_arr.set(format_buf, offset); 
    offset += format_buf.length;

    let version = numberToBuffer(1000000);
    combined_arr.set(version, offset); 
    offset += version.length;

    let newlen = numberToBuffer(newbuffer.length);
    combined_arr.set(newlen, offset); 
    offset += newlen.length;

    combined_arr.set(newbuffer, offset);
    offset += newbuffer.length;

    combined_arr.set(remaining, offset);
    offset += remaining.length;

    fs.writeFileSync("full.h5", combined_arr);
}

scran.terminate();
