package com.flowdash.service;

import com.flowdash.service.exception.ResourceNotFoundException;
import com.flowdash.service.exception.StorageOperationException;
import com.flowdash.service.exception.StorageUnavailableException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.UUID;

@Service
public class SupabaseStorageService {

    private static final long MAX_FILE_SIZE_BYTES = 25L * 1024L * 1024L;
    private static final String LOCAL_PREFIX = "local://";

    private final HttpClient httpClient;
    private final String supabaseUrl;
    private final String serviceRoleKey;
    private final String bucket;
    private final boolean localFallbackEnabled;
    private final Path localRoot;

    public SupabaseStorageService(
            @Value("${flowdash.supabase.url:${SUPABASE_URL:}}") String supabaseUrl,
            @Value("${flowdash.supabase.service-role-key:${SUPABASE_SERVICE_ROLE_KEY:}}") String serviceRoleKey,
            @Value("${flowdash.supabase.storage-bucket:${SUPABASE_STORAGE_BUCKET:}}") String bucket,
            @Value("${flowdash.supabase.local-fallback-enabled:true}") boolean localFallbackEnabled
    ) {
        this.httpClient = HttpClient.newHttpClient();
        this.supabaseUrl = trimTrailingSlash(supabaseUrl);
        this.serviceRoleKey = serviceRoleKey == null ? "" : serviceRoleKey.trim();
        this.bucket = bucket == null ? "" : bucket.trim();
        this.localFallbackEnabled = localFallbackEnabled;
        this.localRoot = Path.of(System.getProperty("java.io.tmpdir"), "flowdash-mindvault-storage");
    }

    public boolean isConfigured() {
        return !supabaseUrl.isBlank() && !serviceRoleKey.isBlank() && !bucket.isBlank();
    }

    public boolean isUploadEnabled() {
        return isConfigured() || localFallbackEnabled;
    }

    public StoredObject upload(Long userId, Long itemId, MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Choose a file to upload");
        }
        if (file.getSize() > MAX_FILE_SIZE_BYTES) {
            throw new IllegalArgumentException("File must be 25 MB or smaller");
        }

        String originalName = file.getOriginalFilename() == null ? "resource" : file.getOriginalFilename();
        String path = "mindvault/%d/%d/%s-%s".formatted(userId, itemId, UUID.randomUUID(), sanitizeFileName(originalName));
        String contentType = file.getContentType() == null || file.getContentType().isBlank()
                ? "application/octet-stream"
                : file.getContentType();

        if (!isConfigured()) {
            return uploadLocally(path, contentType, originalName, file);
        }

        try {
            HttpRequest request = HttpRequest.newBuilder(uploadUri(path))
                    .header("Authorization", "Bearer " + serviceRoleKey)
                    .header("apikey", serviceRoleKey)
                    .header("Content-Type", contentType)
                    .header("x-upsert", "false")
                    .PUT(HttpRequest.BodyPublishers.ofByteArray(file.getBytes()))
                    .build();
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                throw new StorageOperationException("Supabase upload failed");
            }
            return new StoredObject(path, contentType, file.getSize(), originalName);
        } catch (IOException exception) {
            throw new StorageOperationException("Unable to read uploaded file", exception);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new StorageOperationException("Supabase upload was interrupted", exception);
        }
    }

    public void delete(String storagePath) {
        if (storagePath == null || storagePath.isBlank()) {
            return;
        }
        if (isLocalPath(storagePath)) {
            deleteLocal(storagePath);
            return;
        }
        if (!isConfigured()) {
            return;
        }
        String body = "{\"prefixes\":[\"" + escapeJson(storagePath) + "\"]}";
        try {
            HttpRequest request = HttpRequest.newBuilder(URI.create("%s/storage/v1/object/%s".formatted(supabaseUrl, encodePath(bucket))))
                    .header("Authorization", "Bearer " + serviceRoleKey)
                    .header("apikey", serviceRoleKey)
                    .header("Content-Type", "application/json")
                    .method("DELETE", HttpRequest.BodyPublishers.ofString(body))
                    .build();
            httpClient.send(request, HttpResponse.BodyHandlers.discarding());
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
        } catch (Exception ignored) {
            // Metadata deletion should still succeed if the remote object is already gone.
        }
    }

    public StoredContent download(String storagePath) {
        if (storagePath == null || storagePath.isBlank()) {
            throw new ResourceNotFoundException("Uploaded file not found");
        }
        if (isLocalPath(storagePath)) {
            return downloadLocal(storagePath);
        }
        if (!isConfigured()) {
            throw new StorageUnavailableException("File storage is not configured");
        }
        try {
            HttpRequest request = HttpRequest.newBuilder(downloadUri(storagePath))
                    .header("Authorization", "Bearer " + serviceRoleKey)
                    .header("apikey", serviceRoleKey)
                    .GET()
                    .build();
            HttpResponse<byte[]> response = httpClient.send(request, HttpResponse.BodyHandlers.ofByteArray());
            if (response.statusCode() == 404) {
                throw new ResourceNotFoundException("Uploaded file not found");
            }
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                throw new StorageOperationException("Unable to read uploaded file");
            }
            String contentType = response.headers().firstValue("Content-Type").orElse("application/octet-stream");
            return new StoredContent(response.body(), contentType);
        } catch (IOException exception) {
            throw new StorageOperationException("Unable to read uploaded file", exception);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new StorageOperationException("File download was interrupted", exception);
        }
    }

    private URI uploadUri(String path) {
        return URI.create("%s/storage/v1/object/%s/%s".formatted(supabaseUrl, encodePath(bucket), encodePath(path)));
    }

    private URI downloadUri(String path) {
        return URI.create("%s/storage/v1/object/%s/%s".formatted(supabaseUrl, encodePath(bucket), encodePath(path)));
    }

    private StoredObject uploadLocally(String path, String contentType, String originalName, MultipartFile file) {
        if (!localFallbackEnabled) {
            throw new StorageUnavailableException("File storage is not configured");
        }
        Path target = localFilePath(path);
        try {
            Files.createDirectories(target.getParent());
            Files.write(target, file.getBytes());
            return new StoredObject(LOCAL_PREFIX + path, contentType, file.getSize(), originalName);
        } catch (IOException exception) {
            throw new StorageOperationException("Unable to store uploaded file locally", exception);
        }
    }

    private StoredContent downloadLocal(String storagePath) {
        Path file = localFilePath(storagePath.substring(LOCAL_PREFIX.length()));
        if (!Files.exists(file)) {
            throw new ResourceNotFoundException("Uploaded file not found");
        }
        try {
            String contentType = Files.probeContentType(file);
            return new StoredContent(Files.readAllBytes(file), contentType == null ? "application/octet-stream" : contentType);
        } catch (IOException exception) {
            throw new StorageOperationException("Unable to read uploaded file", exception);
        }
    }

    private void deleteLocal(String storagePath) {
        try {
            Files.deleteIfExists(localFilePath(storagePath.substring(LOCAL_PREFIX.length())));
        } catch (IOException ignored) {
            // Metadata deletion should still succeed if the local file is already gone.
        }
    }

    private Path localFilePath(String relativePath) {
        Path candidate = localRoot.resolve(relativePath).normalize();
        if (!candidate.startsWith(localRoot)) {
            throw new StorageOperationException("Invalid storage path");
        }
        return candidate;
    }

    private static boolean isLocalPath(String storagePath) {
        return storagePath.startsWith(LOCAL_PREFIX);
    }

    private static String trimTrailingSlash(String value) {
        if (value == null) {
            return "";
        }
        return value.trim().replaceAll("/+$", "");
    }

    private static String sanitizeFileName(String value) {
        String sanitized = value.replace('\\', '/');
        int slash = sanitized.lastIndexOf('/');
        if (slash >= 0) {
            sanitized = sanitized.substring(slash + 1);
        }
        sanitized = sanitized.replaceAll("[^A-Za-z0-9._-]", "-");
        return sanitized.isBlank() ? "resource" : sanitized;
    }

    private static String encodePath(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8).replace("+", "%20").replace("%2F", "/");
    }

    private static String escapeJson(String value) {
        return value.replace("\\", "\\\\").replace("\"", "\\\"");
    }

    public record StoredObject(String storagePath, String mimeType, Long sizeBytes, String originalFileName) {
    }

    public record StoredContent(byte[] bytes, String mimeType) {
    }
}
