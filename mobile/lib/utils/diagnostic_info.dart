import 'dart:io';

String buildDiagnosticInfo({
  required String version,
  required String runtimeLabel,
}) {
  return [
    'App: TinyNote',
    'Version: ${version.isEmpty ? 'unknown' : version}',
    'Runtime: $runtimeLabel',
    'OS: ${Platform.operatingSystem} ${Platform.operatingSystemVersion}',
  ].join('\n');
}
