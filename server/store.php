<?php
declare(strict_types=1);
/** Private flat-file state. The lock is separate from the file replaced by rename. */
final class FlatFileStore {
    private string $directory;
    private string $stateFile;
    private string $lockFile;
    public function __construct(string $directory, ?string $publicRoot = null, bool $create = false) {
        if (!str_starts_with($directory, DIRECTORY_SEPARATOR)) throw new RuntimeException('Storage path must be absolute.');
        if ($publicRoot !== null) {
            $public = realpath($publicRoot);
            $candidate = realpath($directory) ?: (realpath(dirname($directory)) . DIRECTORY_SEPARATOR . basename($directory));
            if (!$public || $candidate === $public || str_starts_with($candidate, $public . DIRECTORY_SEPARATOR)) throw new RuntimeException('CMS state must be outside the public root.');
        }
        if (!is_dir($directory) && (!$create || !mkdir($directory, 0700, true))) throw new RuntimeException('Run the private CMS installer first.');
        $this->directory = realpath($directory) ?: throw new RuntimeException('Invalid storage directory.');
        if ($publicRoot !== null) {
            $public = realpath($publicRoot);
            if ($this->directory === $public || str_starts_with($this->directory, $public . DIRECTORY_SEPARATOR)) throw new RuntimeException('CMS state must be private.');
        }
        chmod($this->directory, 0700);
        $this->stateFile = $this->directory . '/state.json';
        $this->lockFile = $this->directory . '/state.lock';
        if (!is_file($this->stateFile)) {
            if (!$create) throw new RuntimeException('CMS has not been installed.');
            $this->update(static fn(array &$state) => null);
        }
    }
    private function load(): array {
        if (!is_file($this->stateFile)) return ['version'=>1,'users'=>[],'sessions'=>[],'documents'=>[],'media'=>[],'rates'=>[],'audit'=>[]];
        $data = json_decode(file_get_contents($this->stateFile), true, 512, JSON_THROW_ON_ERROR);
        if (!is_array($data) || ($data['version'] ?? null) !== 1) throw new RuntimeException('Invalid CMS state.');
        foreach (['users','sessions','documents','media','rates','audit'] as $key) if (!isset($data[$key]) || !is_array($data[$key])) throw new RuntimeException('Incomplete CMS state.');
        return $data;
    }
    private function atomicWrite(string $destination, string $content): void {
        $temporary = tempnam($this->directory, '.cms-');
        if ($temporary === false) throw new RuntimeException('Cannot create state file.');
        try {
            chmod($temporary, 0600);
            if (file_put_contents($temporary, $content, LOCK_EX) !== strlen($content) || !rename($temporary, $destination)) throw new RuntimeException('Cannot save CMS state.');
        } finally { if (is_file($temporary)) unlink($temporary); }
    }
    private function locked(bool $write, callable $callback): mixed {
        $handle = fopen($this->lockFile, 'c+');
        if ($handle === false) throw new RuntimeException('Cannot open CMS lock.');
        chmod($this->lockFile, 0600);
        try {
            if (!flock($handle, $write ? LOCK_EX : LOCK_SH)) throw new RuntimeException('Cannot lock CMS state.');
            $state = $this->load();
            $result = $callback($state);
            if ($write) {
                $encoded = json_encode($state, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
                if (is_file($this->stateFile)) $this->atomicWrite($this->directory . '/state.backup.json', file_get_contents($this->stateFile));
                $this->atomicWrite($this->stateFile, $encoded);
            }
            return $result;
        } finally { flock($handle, LOCK_UN); fclose($handle); }
    }
    public function read(callable $callback): mixed { return $this->locked(false, $callback); }
    public function update(callable $callback): mixed { return $this->locked(true, $callback); }
}
