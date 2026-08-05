const workspaceConfigDir = '.tinynotes';

bool isNoteSpaceDirectoryName(String name) {
  return name.endsWith('.tinynotes') && name != workspaceConfigDir;
}
