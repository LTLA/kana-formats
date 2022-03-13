# Export format, version 1

## Overview

This document describes version 1 of the export format for the **kana** application.
This version can be considered the first release version,
improving on version 0 by offering HDF5-based random access of specific results.
See the `from_v0/` subdirectory for a converter script from version 0.

## Layout

The first 8 bytes define an unsigned 64-bit integer in little-endian, specifying the format type.
This is used to denote whether the input data files are embedded (0) or linked (1);
the former is used for export to a standalone file while the latter is used to save the state to the browser's cache.

The next 8 bytes define another unsigned 64-bit integer describing the format version.
This document will only consider version 1.0, i.e., `1000000`.

The next 8 bytes define another unsigned 64-bit integer specifying the size of the blob containing a gzipped JSON with the analysis parameters and results. 
Let's call this value `state_nbytes`.

The next `state_nbytes` bytes contain a HDF5 file capturing the analysis state.
Specifically, each analysis step is represented by a HDF5 group that contains the parameters and results.
See the next section for details on the expected groups.

The remaining bytes contain the embedded input files when the format type is "embedded".
Each file can be excised by reading the offsets and sizes in the `inputs` field.

## HDF5 structure

### Comments

Each HDF5 group will contain two child groups, `parameters` and `results`.
The former will contain the analysis parameters while the latter will contain the analysis results.

The exact type of integers and floating point values is left to the implementation.
Most implementations will use `int32` and `double`s, respectively, but it is allowed to sacrifice some precision to reduce memory usage.

The string type and encoding is left to the implementation.
None of the expected keywords use Unicode characters so the encoding doesn't matter.

Booleans are saved as integers with the usual interpretation, 
i.e., 0 for false and 1 for true.

A scalar HDF5 dataset will be referred to as a "scalar".
Otherwise, a "dataset" refers to a non-scalar HDF5 dataset, which is assumed to have 1 dimension unless explicitly stated otherwise.

### Group `inputs`

`parameters` will contain:

- `format`: a scalar string specifying the input file format.
  This is currently either `"MatrixMarket"`, for a MatrixMarket file (with possible feature annotations);
  `"10X"`, for the 10X Genomics HDF5 matrix format;
  or `"H5AD"`, for the H5AD format.
- `files`: a group of groups representing an array of input file information.
  Each inner group is named by their positional index in the array and contains information about a specific input file:
  - `type`: a scalar string specifying the type of the file.
    This may be `"mtx"`, `"genes"` or `"annotation"` for the MatrixMarket file, feature information and barcode annotations, respectively, when `format = "MatrixMarket"`,
    otherwise it should be `h5`.
  - `name`: a scalar string specifying the file name as it was provided to **kana**.
  - `offset`: a scalar integer specifying where the file starts as an offset from the start of the remaining bytes section.
  - `size`: a scalar integer specifying the number of bytes in the file.

`results` will contain:

- `dimensions`: an integer dataset of length 2,
  containing the number of features and the number of cells in the dataset.
- `permutation`: an integer dataset of length equal to the number of cells,
  describing the permutation to be applied to the per-gene results (see below) to recover the original row order.

For transition purposes, `permutation` may be absent, replaced by a `genes` group.
Each child group is a string dataset of length equal to the number of genes, containing gene-level annotations, most typically IDs.
This option is only provided for the sake of the version 0 converters and should not be used otherwise.

### Group `quality_control`

`parameters` will contain:

- `use_mito_default`: a scalar integer to be interpreted as a boolean.
  This specifies whether to use the default mitochondrial gene list.
- `mito_prefix`: a scalar string containing the expected prefix for mitochondrial gene symbols.
- `nmads`: a scalar float specifying the number of MADs to use to define the QC thresholds.

`results` will contain:

- `metrics`, a group containing per-cell QC metrics.
  This contains:
  - `sums`: a float dataset of length equal to the number of cells, containing the total count for each cell.
  - `detected`:  an integer dataset of length equal to the number of cells, containing the total number of detected genes for each cell.
  - `proportion`: a float dataset of length equal to the number of cells, containing the percentage of counts in (mitochondrial) genes.
- `thresholds`, a group containing per-cell QC metrics.
  This contains:
  - `sums`: a float dataset of length equal to the number of batches, containing the total count threshold for each batch.
  - `detected`:  an integer dataset of length equal to the number of batches, containing the threshold on the total number of detected genes for each batch.
  - `proportion`: a float dataset of length equal to the number of batches, containing the threshold on the percentage of counts in (mitochondrial) genes for each batch.
  For simple analyses, we assume that only one batch is present, so all datasets will be of length 1.
- `discards`: an integer dataset of length equal to the number of cells.
  Each value is interpreted as a boolean and specifies whether the corresponding cell would be discarded by the filter thresholds.

### Group `normalization`

`parameters` is empty.

`results` is empty.

### Group `feature_selection`

`parameters` will contain:

- `span`: a scalar float specifying the span to use for the LOWESS smoother.

`results` will contain:

- `means`: a `Float64Array` containing the mean log-expression of each gene.
- `vars`: a `Float64Array` containing the variance in log-expression of each gene.
- `fitted`: a `Float64Array` containing the fitted value of the trend for each gene.
- `resids`: a `Float64Array` containing the residuals from the trend for each gene.

### Group `pca`

`parameters` will contain:

- `num_hvgs`: a scalar integer containing the number of highly variable genes to use to compute the PCA.
- `num_pcs`: a scalar integer containing the number of PCs to compute.

`results` will contain:

- `pcs`: a 2-dimensional float dataset containing the PC coordinates in a row-major layout.
  Each row corresponds to a cell (after QC filtering) and each column corresponds to a PC.
  Note that this is deliberately transposed from the Javascript/Wasm representation for easier storage.
- `var_exp`: a float dataset of length equal to the number of PCs, containing the percentage of variance explained by each PC.

### Group `neighbor_index`

`parameters` will contain:

- `approximate`: an integer scalar to be interpreted as a boolean, specifying whether an approximate nearest neighbor search should be performed.

`results` is empty.

### Group `tsne`

`parameters` will contain:

- `perplexity`: a scalar float specifying the t-SNE perplexity.
- `iterations`: a scalar integer specifying the t-SNE iterations.
- `animate`: a scalar integer to be interpreted as a boolean, indicating whether an animation should be performed.

`results` will contain:

- `x`: a float dataset of length equal to the number of cells (after QC filtering), containing the x-coordinates for each cell.
- `y`: a float dataset of length equal to the number of cells (after QC filtering), containing the y-coordinates for each cell.

### Group `umap`

`parameters` will contain:

- `num_epochs`: a scalar integer containing the number of epochs to perform.
- `num_neighbors`: a scalar integer containing the number of nearest neighbors to use when constructing the sets.
- `min_dist`: a scalar float specifying the minimum distance between points.
- `animate`: a scalar integer to be interpreted as a boolean, indicating whether an animation should be performed.

`results` will contain:

- `x`: a float dataset of length equal to the number of cells (after QC filtering), containing the x-coordinates for each cell.
- `y`: a float dataset of length equal to the number of cells (after QC filtering), containing the y-coordinates for each cell.

### Group `kmeans_cluster` 

`parameters` will contain:

- `k`: a scalar integer specifying the number of clusters to create.

If k-means clustering was performed, `results` will contain:

- `clusters`: an integer dataset of length equal to the number of cells (after QC filtering), 
  containing the k-means cluster assignment for each cell.

If k-means clustering was not performed, `results` will be empty.

### Group `snn_graph_cluster`

`parameters` will contain:

- `k`: a scalar integer specifying the number of nearest neighbors to find.
- `scheme`: a scalar string specifying the edge weighting scheme to use.
  This may be `"rank"`, `"number"` or `"jaccard"`.
- `resolution`: a scalar float specifying the resolution of the multi-level community detection.

If SNN graph clustering was used in the analysis, `results` will contain:

- `clusters`: an integer dataset of length equal to the number of cells (after QC filtering), 
  containing the SNN graph cluster assignment for each cell.

If SNN graph clustering was not performed, `results` will be empty.

### Group `choose_clustering`

`parameters` will contain:

- `method`: a scalar string specifying the clustering method to use.
  This is currently either `snn_graph` or `kmeans`.

`results` is empty.

Depending on the `method`, `snn_graph_cluster` or `kmeans_cluster` must have non-empty `results`.
Both may also be non-empty, in which case the appropriate clustering is chosen based on `method`.

### Group `marker_detection`

`parameters` is empty.

`results` will contain:

- `clusters`: a group representing an array of length equal to the number of clusters.
  Each child is another group that is named by the cluster index, containing the marker details for that gene.
  Each child group contains:
  - `means`: a float dataset of length equal to the number of genes, containing the mean expression of each gene in the current cluster.
  - `detected`: a float dataset of length equal to the number of genes, containing the proportion of cells with detected expression of each gene in the current cluster.
  - `lfc`: an group containing statistics for the log-fold changes from all pairwise comparisons involving the current cluster.
    This contains:
    - `min`: a float dataset of length equal to the number of genes, containing the minimum log-fold change across all pairwise comparisons for each gene.
    - `mean`: a float dataset of length equal to the number of genes, containing the mean log-fold change across all pairwise comparisons for each gene.
    - `min-rank`: a float dataset of length equal to the number of genes, containing the minimum rank of the log-fold changes across all pairwise comparisons for each gene.
  - `delta-detected`: same as `lfc`, but for the delta-detected (i.e., difference in the percentage of detected expression).
  - `cohen`: same as `lfc`, but for Cohen's d.
  - `auc`: same as `lfc`, but for the AUCs.

### Group `custom_selections`

`parameters` will contain:

- `selections`: a group defining the custom selections.
  Each child is named after a user-created selection.
  Each child is an integer dataset of arbitrary length containing the indices of the selected cells.
  Note that indices refer to the dataset after QC filtering.

`results` will contain:

- `markers`: a group containing the marker results for each selection after a comparison to a group containing all other cells.
  Each child is named after its selection and is a group containing:
  - `means`: a float dataset of length equal to the number of genes, containing the mean expression of each gene in the selection.
  - `detected`: a float dataset of length equal to the number of genes, containing the proportion of cells with detected expression of each gene in the selection.
  - `lfc`: a float dataset of length equal to the number of genes, containing the log-fold change in the selection compared to all other cells.
  - `delta-detected`: same as `lfc`, but for the delta-detected (i.e., difference in the percentage of detected expression).
  - `cohen`: same as `lfc`, but for Cohen's d.
  - `auc`: same as `lfc`, but for the AUCs.

### Group `cell_labelling`:

> ⚠️  This group should be considered optional for back-compatibility purposes.

`parameters` will contain:

- `human_references`: a string dataset defining the human reference datasets used for labelling.
  Each entry contains the name of a reference dataset, e.g., `"BlueprintEncode"`.
- `mouse_references`: a string dataset defining the mouse reference datasets used for labelling.
  Each entry contains the name of a reference dataset, e.g., `"ImmGen"`.

`results` will contain:

- `per_reference`: a group containing the label assignments for each cluster in each reference.
  Each child is named after its corresponding reference, and is a string dataset of length equal to the number of clusters.
  Entries of the dataset contain the assigned label for the corresponding cluster.

For multiple references of the relevant species, `results` will also contain:

- `integrated`: a string dataset of length equal to the number of clusters.
  This specifies the reference with the top-scoring label for each cluster, after integrating the results of all per-reference classifications.

## Remaining bytes

This is a literal concatenation of all input files, so it is usually best if users supply compressed content.
**kana** will not perform any compression on its own.
