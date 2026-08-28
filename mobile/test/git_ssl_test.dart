import 'package:flutter_test/flutter_test.dart';
import 'package:tinynote_mobile/services/git_ssl.dart';

void main() {
  group('gitHttpsHost', () {
    test('parses https git urls', () {
      expect(
        gitHttpsHost('https://git.wu2kong.com/wu2kong/Tinynotes.git'),
        'git.wu2kong.com',
      );
      expect(gitHttpsHost('https://GitHub.com/user/notes.git'), 'github.com');
    });

    test('returns null for empty or invalid urls', () {
      expect(gitHttpsHost(''), isNull);
      expect(gitHttpsHost('not a url'), isNull);
    });
  });

  group('acceptGitTlsCertificate', () {
    test('accepts certificates libgit2 already trusts', () {
      expect(
        acceptGitTlsCertificate(libgit2Valid: true, host: 'example.com'),
        isTrue,
      );
    });

    test('accepts hosts already trusted by the system TLS stack', () {
      expect(
        acceptGitTlsCertificate(
          libgit2Valid: false,
          host: 'git.wu2kong.com',
          systemTrustedHosts: {'git.wu2kong.com'},
        ),
        isTrue,
      );
    });

    test('rejects untrusted hosts when libgit2 also rejects them', () {
      expect(
        acceptGitTlsCertificate(
          libgit2Valid: false,
          host: 'evil.example',
          systemTrustedHosts: {'git.wu2kong.com'},
        ),
        isFalse,
      );
    });
  });
}
