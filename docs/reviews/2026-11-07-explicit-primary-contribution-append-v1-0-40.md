# Explicit primary contribution repair, v1.0.40

A missing primary mandate could enter a BiographyOutputDelta repair whose schema could update existing output quotes but could not append the required source binding. The postcondition required an append that the native schema could not express. A complete, schema-valid paid correction was consequently rejected before the bounded residual cleanup could run.

Primary-mandate targets now require a separate primary_contribution with one original source quote, actual BIO passage and evidenced personal role. The application supplies the fixed required matter ID and appends exactly one source binding; existing source bindings, profile units, categories and identity are copied unchanged. Supporting evidence is appended only when absent. The original source, personal-attribution, confidentiality and unchanged-BIO postconditions remain mandatory. Legacy full-candidate diagnostics retain their strict guards.

A terminal development rejection also overrides stale draft-ready markers in Studio. Its finding explains that the final document pair was not prepared and directs the user to share the existing attempt reference with the administrator. It does not promise an automatic retry or request another source upload.

Validation: 602 Python tests passed; 498 Node tests passed with one skip; TypeScript passed. Synthetic tests cover primary evidence already present or absent, exact append, immutable existing sources and categories, forbidden model-selected matter IDs, invented evidence and loss of the existing BIO. A saved-response offline diagnostic reproduced the old impossible append without generation. These checks do not establish final-document quality or a successful production run under this new schema.
