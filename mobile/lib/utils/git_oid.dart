import 'package:git2dart/git2dart.dart';

/// libgit2 OIDs from [Reference.target] point into the reference object.
/// Looking them up after [Reference.free] reads a zeroed / dangling OID and
/// fails with `null OID cannot exist`.
bool isZeroGitOid(Oid oid) {
  try {
    final sha = oid.sha;
    if (sha.isEmpty) return true;
    for (final code in sha.codeUnits) {
      if (code != 48) return false;
    }
    return true;
  } catch (_) {
    return true;
  }
}

/// Snapshot an OID by SHA so it stays valid after its source object is freed.
Oid? copyGitOid(Oid oid) {
  if (isZeroGitOid(oid)) return null;
  try {
    return Oid.fromSHAParse(oid.sha);
  } catch (_) {
    return null;
  }
}
