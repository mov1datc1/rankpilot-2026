/** Browser-safe approval contract shared by Studio, worker and downloads. */
export const REVIEW_POLICY_VERSION = 'review-core-v3.2';
export const RENDERER_VERSION = 17;
export const ARTIFACT_REVIEW_VERSION = 15;

/** Current server requirements, also advertised to tabs open across deployments. */
export const REVIEW_CONTRACT = {policy: REVIEW_POLICY_VERSION, renderer: RENDERER_VERSION, artifact: ARTIFACT_REVIEW_VERSION};
