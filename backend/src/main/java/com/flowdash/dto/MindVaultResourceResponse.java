package com.flowdash.dto;

import com.flowdash.domain.MindVaultResourceType;

import java.time.Instant;

public record MindVaultResourceResponse(
        Long id,
        Long itemId,
        MindVaultResourceType resourceType,
        String title,
        String description,
        String url,
        String storagePath,
        String mimeType,
        Long sizeBytes,
        String originalFileName,
        String contentUrl,
        Instant createdAt,
        Instant updatedAt
) {
}
