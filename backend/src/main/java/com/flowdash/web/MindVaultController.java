package com.flowdash.web;

import com.flowdash.dto.MindVaultAnalyticsResponse;
import com.flowdash.dto.MindVaultItemRequest;
import com.flowdash.dto.MindVaultItemResponse;
import com.flowdash.dto.MindVaultOverviewResponse;
import com.flowdash.dto.MindVaultReviewLogResponse;
import com.flowdash.dto.MindVaultReviewRequest;
import com.flowdash.dto.MindVaultResourceRequest;
import com.flowdash.dto.MindVaultResourceResponse;
import com.flowdash.dto.MindVaultSprintRequest;
import com.flowdash.dto.MindVaultSprintResponse;
import com.flowdash.dto.MindVaultStatsResponse;
import com.flowdash.dto.MindVaultSubjectRequest;
import com.flowdash.dto.MindVaultSubjectResponse;
import com.flowdash.service.ApiMappers;
import com.flowdash.service.MindVaultService;
import jakarta.validation.Valid;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDate;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Locale;

@RestController
@RequestMapping("/api/mindvault")
public class MindVaultController {

    private final MindVaultService mindVaultService;

    public MindVaultController(MindVaultService mindVaultService) {
        this.mindVaultService = mindVaultService;
    }

    @GetMapping("/overview")
    public MindVaultOverviewResponse overview() {
        return ApiMappers.toMindVaultOverviewResponse(mindVaultService.snapshot());
    }

    @GetMapping("/inbox")
    public MindVaultOverviewResponse inbox() {
        return overview();
    }

    @GetMapping("/library")
    public MindVaultOverviewResponse library() {
        return overview();
    }

    @GetMapping("/subjects/overview")
    public MindVaultOverviewResponse subjectsOverview() {
        return overview();
    }

    @GetMapping("/insights")
    public MindVaultOverviewResponse insights() {
        return overview();
    }

    @GetMapping("/analytics")
    public MindVaultAnalyticsResponse analytics() {
        return ApiMappers.toMindVaultAnalyticsResponse(mindVaultService.snapshot());
    }

    @GetMapping("/stats")
    public MindVaultStatsResponse stats() {
        return ApiMappers.toMindVaultStatsResponse(mindVaultService.snapshot());
    }

    @GetMapping("/subjects")
    public List<MindVaultSubjectResponse> listSubjects() {
        var snapshot = mindVaultService.snapshot();
        return snapshot.subjects().stream()
                .map(subject -> ApiMappers.toMindVaultSubjectResponse(subject, snapshot.items(), mindVaultService.queue()))
                .toList();
    }

    @PostMapping("/subjects")
    public MindVaultSubjectResponse createSubject(@Valid @RequestBody MindVaultSubjectRequest request) {
        var saved = mindVaultService.createSubject(request);
        var snapshot = mindVaultService.snapshot();
        return ApiMappers.toMindVaultSubjectResponse(saved, snapshot.items(), mindVaultService.queue());
    }

    @PutMapping("/subjects/{id}")
    public MindVaultSubjectResponse updateSubject(@PathVariable Long id, @Valid @RequestBody MindVaultSubjectRequest request) {
        var saved = mindVaultService.updateSubject(id, request);
        var snapshot = mindVaultService.snapshot();
        return ApiMappers.toMindVaultSubjectResponse(saved, snapshot.items(), mindVaultService.queue());
    }

    @DeleteMapping("/subjects/{id}")
    public void deleteSubject(@PathVariable Long id) {
        mindVaultService.deleteSubject(id);
    }

    @GetMapping("/sprints")
    public List<MindVaultSprintResponse> listSprints() {
        var snapshot = mindVaultService.snapshot();
        return snapshot.sprints().stream()
                .map(sprint -> ApiMappers.toMindVaultSprintResponse(sprint, snapshot.items(), mindVaultService.queue()))
                .toList();
    }

    @PostMapping("/sprints")
    public MindVaultSprintResponse createSprint(@Valid @RequestBody MindVaultSprintRequest request) {
        var saved = mindVaultService.createSprint(request);
        var snapshot = mindVaultService.snapshot();
        return ApiMappers.toMindVaultSprintResponse(saved, snapshot.items(), mindVaultService.queue());
    }

    @PutMapping("/sprints/{id}")
    public MindVaultSprintResponse updateSprint(@PathVariable Long id, @Valid @RequestBody MindVaultSprintRequest request) {
        var saved = mindVaultService.updateSprint(id, request);
        var snapshot = mindVaultService.snapshot();
        return ApiMappers.toMindVaultSprintResponse(saved, snapshot.items(), mindVaultService.queue());
    }

    @DeleteMapping("/sprints/{id}")
    public void deleteSprint(@PathVariable Long id) {
        mindVaultService.deleteSprint(id);
    }

    @GetMapping("/items")
    public List<MindVaultItemResponse> listItems() {
        return mindVaultService.listItems().stream().map(ApiMappers::toMindVaultItemResponse).toList();
    }

    @GetMapping("/queue")
    public List<MindVaultItemResponse> queue() {
        return mindVaultService.queue().stream().map(ApiMappers::toMindVaultItemResponse).toList();
    }

    @GetMapping("/review-queue")
    public List<MindVaultItemResponse> reviewQueue(@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return mindVaultService.queue(date).stream().map(item -> ApiMappers.toMindVaultItemResponse(item, date == null ? LocalDate.now(java.time.ZoneOffset.UTC) : date)).toList();
    }

    @PostMapping("/items")
    public MindVaultItemResponse createItem(@Valid @RequestBody MindVaultItemRequest request) {
        return ApiMappers.toMindVaultItemResponse(mindVaultService.createItem(request));
    }

    @PutMapping("/items/{id}")
    public MindVaultItemResponse updateItem(@PathVariable Long id, @Valid @RequestBody MindVaultItemRequest request) {
        return ApiMappers.toMindVaultItemResponse(mindVaultService.updateItem(id, request));
    }

    @DeleteMapping("/items/{id}")
    public void deleteItem(@PathVariable Long id) {
        mindVaultService.deleteItem(id);
    }

    @PostMapping("/items/{id}/reviews")
    public MindVaultReviewLogResponse reviewItem(@PathVariable Long id, @Valid @RequestBody MindVaultReviewRequest request) {
        return ApiMappers.toMindVaultReviewLogResponse(mindVaultService.reviewItem(id, request));
    }

    @PostMapping(path = "/items/{id}/resources", consumes = MediaType.APPLICATION_JSON_VALUE)
    public MindVaultResourceResponse createResource(@PathVariable Long id, @Valid @RequestBody MindVaultResourceRequest request) {
        return ApiMappers.toMindVaultResourceResponse(mindVaultService.createResource(id, request));
    }

    @PostMapping(path = "/items/{id}/resources", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public MindVaultResourceResponse uploadResource(
            @PathVariable Long id,
            @RequestPart("file") MultipartFile file,
            @RequestParam(required = false) String title,
            @RequestParam(required = false) String description
    ) {
        return ApiMappers.toMindVaultResourceResponse(mindVaultService.uploadResource(id, title, description, file));
    }

    @GetMapping("/resources/{id}/content")
    public ResponseEntity<byte[]> resourceContent(@PathVariable Long id) {
        MindVaultService.StoredMindVaultResourceContent content = mindVaultService.loadResourceContent(id);
        String mimeType = content.mimeType() == null || content.mimeType().isBlank()
                ? MediaType.APPLICATION_OCTET_STREAM_VALUE
                : content.mimeType();
        ContentDisposition disposition = isInlinePreviewable(mimeType, content.fileName())
                ? ContentDisposition.inline().filename(content.fileName(), StandardCharsets.UTF_8).build()
                : ContentDisposition.attachment().filename(content.fileName(), StandardCharsets.UTF_8).build();
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, disposition.toString())
                .contentType(MediaType.parseMediaType(mimeType))
                .body(content.bytes());
    }

    @DeleteMapping("/resources/{id}")
    public void deleteResource(@PathVariable Long id) {
        mindVaultService.deleteResource(id);
    }

    private static boolean isInlinePreviewable(String mimeType, String fileName) {
        String normalizedMime = mimeType == null ? "" : mimeType.toLowerCase(Locale.ROOT);
        String normalizedName = fileName == null ? "" : fileName.toLowerCase(Locale.ROOT);
        return normalizedMime.equals("application/pdf")
                || normalizedMime.startsWith("image/")
                || normalizedMime.startsWith("text/")
                || normalizedMime.endsWith("+json")
                || normalizedMime.equals(MediaType.APPLICATION_JSON_VALUE)
                || normalizedName.endsWith(".pdf")
                || normalizedName.endsWith(".png")
                || normalizedName.endsWith(".jpg")
                || normalizedName.endsWith(".jpeg")
                || normalizedName.endsWith(".gif")
                || normalizedName.endsWith(".svg")
                || normalizedName.endsWith(".txt")
                || normalizedName.endsWith(".md")
                || normalizedName.endsWith(".json");
    }
}
