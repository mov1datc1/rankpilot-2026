/** Apply an explicit user-confirmed role to a profile's standalone role heading.
 * Other prose and original evidence stay intact; no role is inferred from matters.
 */
export function projectConfirmedLawyerRole(lawyer: any) {
  const resolution = lawyer.roleResolution;
  if (resolution?.confirmed !== true || !resolution.reason?.trim() || resolution.role !== lawyer.role || lawyer.isPartner !== (lawyer.role === 'Partner')) return lawyer;
  const heading = /^(Senior Associate|Associate|Partner|Of Counsel|Socio|Socia|Asociado|Asociada)(\s*[·:–—]\s*)/i;
  const project = (value: unknown) => typeof value === 'string' ? value.replace(heading, (_match, _role, separator) => `${lawyer.role}${separator}`) : value;
  const comments = project(lawyer.comments), bio = project(lawyer.bio);
  if (comments === lawyer.comments && bio === lawyer.bio) return lawyer;
  return {...lawyer, comments, bio, roleResolution: {...resolution,
    originalProfile: resolution.originalProfile || {comments: lawyer.comments, bio: lawyer.bio}}};
}
