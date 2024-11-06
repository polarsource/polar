/*
 Copyright 2012, Steffen Hanikel (https://github.com/hanikesn)
 Modified by Artemy Tregubenko, 2014 (https://github.com/arty-name/woff2otf)
 Modified by Jason Johnston, 2019 (pako --> fflate)

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.

 A tool to convert a WOFF back to a TTF/OTF font file, in pure Javascript
*/

import { inflateSync } from 'fflate'

export function convert_streams(bufferIn) {
    var dataViewIn = new DataView(bufferIn);
    var offsetIn = 0;

    function read2() {
        var uint16 = dataViewIn.getUint16(offsetIn);
        offsetIn += 2;
        return uint16;
    }

    function read4() {
        var uint32 = dataViewIn.getUint32(offsetIn);
        offsetIn += 4;
        return uint32;
    }

    function write2(uint16) {
        dataViewOut.setUint16(offsetOut, uint16);
        offsetOut += 2;
    }

    function write4(uint32) {
        dataViewOut.setUint32(offsetOut, uint32);
        offsetOut += 4;
    }

    var WOFFHeader = {
        signature: read4(),
        flavor: read4(),
        length: read4(),
        numTables: read2(),
        reserved: read2(),
        totalSfntSize: read4(),
        majorVersion: read2(),
        minorVersion: read2(),
        metaOffset: read4(),
        metaLength: read4(),
        metaOrigLength: read4(),
        privOffset: read4(),
        privLength: read4()
    };

    var entrySelector = 0;
    while (Math.pow(2, entrySelector) <= WOFFHeader.numTables) {
        entrySelector++;
    }
    entrySelector--;

    var searchRange = Math.pow(2, entrySelector) * 16;
    var rangeShift = WOFFHeader.numTables * 16 - searchRange;

    var offset = 4 + 2 + 2 + 2 + 2;
    var TableDirectoryEntries = [];
    for (var i = 0; i < WOFFHeader.numTables; i++) {
        TableDirectoryEntries.push({
            tag: read4(),
            offset: read4(),
            compLength: read4(),
            origLength: read4(),
            origChecksum: read4()
        });
        offset += 4 * 4;
    }

    var arrayOut = new Uint8Array(
        4 + 2 + 2 + 2 + 2 +
        TableDirectoryEntries.length * (4 + 4 + 4 + 4) +
        TableDirectoryEntries.reduce(function(acc, entry) { return acc + entry.origLength + 4; }, 0)
    );
    var bufferOut = arrayOut.buffer;
    var dataViewOut = new DataView(bufferOut);
    var offsetOut = 0;

    write4(WOFFHeader.flavor);
    write2(WOFFHeader.numTables);
    write2(searchRange);
    write2(entrySelector);
    write2(rangeShift);

    TableDirectoryEntries.forEach(function(TableDirectoryEntry) {
        write4(TableDirectoryEntry.tag);
        write4(TableDirectoryEntry.origChecksum);
        write4(offset);
        write4(TableDirectoryEntry.origLength);

        TableDirectoryEntry.outOffset = offset;
        offset += TableDirectoryEntry.origLength;
        if ((offset % 4) != 0) {
            offset += 4 - (offset % 4)
        }
    });

    var size;

    TableDirectoryEntries.forEach(function(TableDirectoryEntry) {
        var compressedData = bufferIn.slice(
            TableDirectoryEntry.offset,
            TableDirectoryEntry.offset + TableDirectoryEntry.compLength
        );

        if (TableDirectoryEntry.compLength != TableDirectoryEntry.origLength) {
            var uncompressedData = new Uint8Array(TableDirectoryEntry.origLength)
            inflateSync(
              new Uint8Array(compressedData, 2), //skip deflate header
              uncompressedData
            )
        } else {
            uncompressedData = new Uint8Array(compressedData);
        }

        arrayOut.set(uncompressedData, TableDirectoryEntry.outOffset);
        offset = TableDirectoryEntry.outOffset + TableDirectoryEntry.origLength;

        var padding = 0;
        if ((offset % 4) != 0) {
            padding = 4 - (offset % 4);
        }
        arrayOut.set(
            new Uint8Array(padding).buffer,
            TableDirectoryEntry.outOffset + TableDirectoryEntry.origLength
        );

        size = offset + padding;
    });

    return bufferOut.slice(0, size);
}
