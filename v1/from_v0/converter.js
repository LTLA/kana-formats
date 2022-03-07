import * as scran from "scran.js";

function quick_write_string(handle, name, val) {
    let xhandle = handle.createDataSet(name, "String", [], { maxStringLength: val.length });
    xhandle.write(val);
}

function recoverTypedArrays(object) {
    if (Array.isArray(object)) {
        for (var i = 0; i < object.length; i++) {
            object[i] = recoverTypedArrays(object[i]);
        }
    } else if (object instanceof Object) {
        if ("_TypedArray_class" in object) {
            var cls = object[["_TypedArray_class"]];
            var vals = object[["_TypedArray_values"]];
            switch (cls) {
                case "Uint8Array":
                    object = new Uint8Array(vals.length);
                    break;
                case "Int8Array":
                    object = new Int8Array(vals.length);
                    break;
                case "Uint8Array":
                    object = new Uint8Array(vals.length);
                    break;
                case "Uint16Array":
                    object = new Uint16Array(vals.length);
                    break;
                case "Int16Array":
                    object = new Int16Array(vals.length);
                    break;
                case "Uint32Array":
                    object = new Uint32Array(vals.length);
                    break;
                case "Int32Array":
                    object = new Int32Array(vals.length);
                    break;
                case "Uint64Array":
                    object = new Uint64Array(vals.length);
                    break;
                case "Int64Array":
                    object = new Int64Array(vals.length);
                    break;
                case "Float32Array":
                    object = new Float32Array(vals.length);
                    break;
                case "Float64Array":
                    object = new Float64Array(vals.length);
                    break;
                default:
                    throw "unrecognized TypedArray class '" + cls;
            }
            object.set(vals);
        } else {
            for (const [key, element] of Object.entries(object)) {
                object[key] = recoverTypedArrays(element);
            }
        }
    } 
    return object;
}

export function convertFromVersion0(state, newfile) {
    let fhandle = scran.createNewHDF5File(newfile);

    // Storing inputs.
    {
        let ghandle = fhandle.createGroup("inputs");
        let params = state.inputs.parameters;
        let phandle = ghandle.createGroup("parameters");
        quick_write_string(phandle, "format", params.type);

        let fihandle = phandle.createGroup("files")
        for (const [index, info] of params.files.entries()) {
            let xhandle = fihandle.createGroup(String(index));
            quick_write_string(xhandle, "type", info.type);
            quick_write_string(xhandle, "name", info.name);
            {
                let ihandle = xhandle.createDataSet("offset", "Uint32", []);
                ihandle.write(info.buffer.offset);
            }
            {
                let ihandle = xhandle.createDataSet("size", "Uint32", []);
                ihandle.write(info.buffer.size);
            }
        }

        // Only storing the number of cells and genes. If we want the 
        // annotations, we might as well just read from the source.
        let chandle = ghandle.createGroup("contents");
        let dset = chandle.createDataSet("dimensions", "Int32", [2]);
        let contents = state.inputs.contents;
        let ngenes = Object.values(contents.genes)[0].length;
        dset.write([ngenes, contents.num_cells]);
    }

    // Storing quality control. This consolidates elements from 
    // several steps in v0 for simplicity.
    {
        let ghandle = fhandle.createGroup("quality_control");
        let phandle = ghandle.createGroup("parameters");

        let mparams = state.quality_control_metrics.parameters;
        {
            let ihandle = phandle.createDataSet("use_mito_default", "Uint8", []);
            ihandle.write(Number(mparams.use_mito_default));
        }
        {
            let ihandle = phandle.createDataSet("mito_prefix", "String", []);
            ihandle.write(mparams.mito_prefix);
        }

        let tparams = state.quality_control_thresholds.parameters;
        {
            let ihandle = phandle.createDataSet("nmads", "Float64", []);
            ihandle.write(tparams.nmads);
        }

        // Saving all the contents.
        let chandle = ghandle.createGroup("contents");

        let mhandle = chandle.createGroup("metrics");
        let mcontents = recoverTypedArrays(state.quality_control_metrics.contents);
        {
            let dhandle = mhandle.createDataSet("sums", "Float64", [mcontents.sums.length]);
            dhandle.write(mcontents.sums);
        }
        {
            let dhandle = mhandle.createDataSet("detected", "Int32", [mcontents.detected.length]);
            dhandle.write(mcontents.detected);
        }
        {
            let dhandle = mhandle.createDataSet("proportion", "Float64", [mcontents.proportion.length]);
            dhandle.write(mcontents.proportion);
        }

        // Converting the thresholds into arrays to handle multi-batch analyses.
        let thandle = chandle.createGroup("thresholds");
        let tcontents = recoverTypedArrays(state.quality_control_thresholds.contents);
        for (const x of [ "sums", "detected", "proportion" ]) {
            let dhandle = thandle.createDataSet(x, "Float64", [1]);
            dhandle.write([tcontents[x]]);
        }

        let disc = tcontents.discards;
        let dhandle = chandle.createDataSet("discards", "Uint8", [disc.length]);
        dhandle.write(disc);

        // Don't bother saving 'retained', we'll get that from 'discards'.
    }

    // Normalization just needs a group but it doesn't actually have any information right now.
    fhandle.createGroup("normalization");

    // Feature selection.
    {
        let ghandle = fhandle.createGroup("feature_selection");

        let phandle = ghandle.createGroup("parameters");
        {
            let dhandle = phandle.createDataSet("span", "Float64", []);
            dhandle.write(state.feature_selection.parameters.span);
        }

        let chandle = ghandle.createGroup("contents");
        let contents = recoverTypedArrays(state.feature_selection.contents);
        for (const x of [ "means", "vars", "fitted", "resids" ]) {
            let y = contents[x];
            let dhandle = chandle.createDataSet(x, "Float64", [y.length]);
            dhandle.write(y);
        }
    }

    // PCA.
    {
        let ghandle = fhandle.createGroup("pca");

        let phandle = ghandle.createGroup("parameters");
        let params = state.pca.parameters;
        for (const x of [ "num_hvgs", "num_pcs" ]) {
            let dhandle = phandle.createDataSet(x, "Int32", []);
            dhandle.write(params[x]);
        }

        let chandle = ghandle.createGroup("contents");
        let contents = recoverTypedArrays(state.pca.contents);

        let ve = contents.var_exp;
        let vhandle = phandle.createDataSet("var_exp", "Float64", [ve.length]);
        vhandle.write(ve);

        // Save as a matrix.
        let npcs = ve.length;
        let ncells = contents.pcs.length / npcs;
        let pchandle = phandle.createDataSet("pcs", "Float64", [ncells, npcs]); // transposed in HDF5.
        pchandle.write(contents.pcs);
    }

    // Neighbor index.
    {
        let ghandle = fhandle.createGroup("neighbor_index");
        let phandle = ghandle.createGroup("parameters");
        let params = state.pca.parameters;
        let dhandle = phandle.createDataSet("approximate", "Uint8", []);
        dhandle.write(params.approximate);
    }

    // t-SNE details.
    {
        let ghandle = fhandle.createGroup("tsne");

        let phandle = ghandle.createGroup("parameters");
        let params = state.tsne.parameters;
        {
            let dhandle = phandle.createDataSet("perplexity", "Float64", []);
            dhandle.write(params.perplexity);
        }
        {
            let dhandle = phandle.createDataSet("iterations", "Int32", []);
            dhandle.write(params.iterations);
        }
        {
            let dhandle = phandle.createDataSet("animate", "Uint8", []);
            dhandle.write(params.animate);
        }

        let chandle = ghandle.createGroup("contents");
        let contents = recoverTypedArrays(state.tsne.contents);
        {
            let dhandle = chandle.createDataSet("x", "Float64", [contents.x.length]);
            dhandle.write(contents.x);
        }
        {
            let dhandle = chandle.createDataSet("y", "Float64", [contents.y.length]);
            dhandle.write(contents.y);
        }
        // Don't bother saving the number of iterations.
    }

    // UMAP details.
    {
        let ghandle = fhandle.createGroup("umap");

        let phandle = ghandle.createGroup("parameters");
        let params = state.umap.parameters;
        {
            let dhandle = phandle.createDataSet("num_neighbors", "Int32", []);
            dhandle.write(params.num_neighbors);
        }
        {
            let dhandle = phandle.createDataSet("num_epochs", "Int32", []);
            dhandle.write(params.num_epochs);
        }
        {
            let dhandle = phandle.createDataSet("min_dist", "Float64", []);
            dhandle.write(params.min_dist);
        }
        {
            let dhandle = phandle.createDataSet("animate", "Uint8", []);
            dhandle.write(params.animate);
        }

        let chandle = ghandle.createGroup("contents");
        let contents = recoverTypedArrays(state.umap.contents);
        {
            let dhandle = chandle.createDataSet("x", "Float64", [contents.x.length]);
            dhandle.write(contents.x);
        }
        {
            let dhandle = chandle.createDataSet("y", "Float64", [contents.y.length]);
            dhandle.write(contents.y);
        }
        // Don't bother saving the number of iterations.
    }

    // K-means.
    if ("kmeans_cluster" in state) {
        let ghandle = fhandle.createGroup("kmeans_cluster");

        let phandle = ghandle.createGroup("parameters");
        let params = state.kmeans_cluster.parameters;
        {
            let dhandle = phandle.createDataSet("k", "Int32", []);
            dhandle.write(params.k);
        }

        let chandle = ghandle.createGroup("contents");
        let contents = recoverTypedArrays(state.kmeans_cluster.contents);
        {
            let clusters = contents.clusters;
            let dhandle = chandle.createDataSet("clusters", "Int32", [clusters.length]);
            dhandle.write(clusters);
        }
    }
}
