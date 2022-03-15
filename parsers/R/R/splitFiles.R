bufferToNumber <- function(encoded) {
    sum(as.integer(encoded) * (256 ^ (seq_along(encoded) - 1)))
}

#' Split the \pkg{kana} export file into its components
#'
#' Split the analysis file exported by the \pkg{kana} application into its components.
#' Specifically, this refers to a file for the analysis parameters and results,
#' and then further embedded files corresponding to the original inputs.
#'
#' @param path String containing the path to the \pkg{kana} export file.
#' @param state.path String containing the path to the output HDF5 file for the analysis state and parameters.
#' @param file.dir String containing the path to the output directory for the embedded input files.
#'
#' @return 
#' The analysis state is saved to \code{state.path}.
#' For exports containing embedded inputs, \code{file.dir} is created and filled with the separated input files.
#' A list is invisibly returned containing \code{type}, whether the export contained linked or embedded files;
#' and \code{version}, a version number for the exported file.
#'
#' @details
#' Files in \code{file.dir} are named by their index in the analysis parameters of the \code{inputs} step.
#' Ideally we would give them a more intuitive name; however, there is no guarantee that the input files supplied to \pkg{kana} have unique names.
#' 
#' @export
#' @importFrom rhdf5 h5read
splitFiles <- function(path, state.path = "state.h5", file.dir = "files") {
    con <- file(path, open = "rb")

    # Reading in the type; if embedded (0), there are some more files to process.
    type <- readBin(con, what=raw(), n=8) 
    full.type <- bufferToNumber(type)

    # Can't be bothered dealing with older versions right now.
    version <- readBin(con, what=raw(), n=8) 
    full.version <- bufferToNumber(version)
    stopifnot(full.version == 1e6)

    nice.version <- sprintf("%s.%s.%s", 
        floor(full.version/1e6), 
        floor((full.version %% 1e6) / 1e3),
        (full.version %% 1e3)
    )

    # Get length of the state.
    state_len <- bufferToNumber(readBin(con, what=raw(), n=8))

    # Dumping out the state.
    state <- readBin(con, what=raw(), n=state_len)
    writeBin(state, state.path)

    # Reading the files if embedded.
    if (full.type == 0) {
        all.files <- h5read(state.path, "inputs/parameters/files")
        dir.create(file.dir, showWarnings = FALSE, recursive = TRUE)

        ordering <- names(all.files)[order(as.integer(names(all.files)))]
        for (x in ordering) {
            current <- readBin(con, what=raw(), n=all.files[[x]]$size)        
            writeBin(current, file.path(file.dir, x))
        }
    }

    invisible(
        list(
            type = c("embedded", "linked")[full.type + 1], 
            version = package_version(nice.version)
        )
    )
}
