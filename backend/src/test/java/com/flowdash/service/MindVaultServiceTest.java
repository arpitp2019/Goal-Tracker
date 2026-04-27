package com.flowdash.service;

import com.flowdash.domain.AppUser;
import com.flowdash.domain.AuthProvider;
import com.flowdash.domain.MindVaultItemSource;
import com.flowdash.domain.MindVaultItemStatus;
import com.flowdash.domain.MindVaultLearningItem;
import com.flowdash.domain.MindVaultResource;
import com.flowdash.domain.MindVaultResourceType;
import com.flowdash.domain.MindVaultSprint;
import com.flowdash.domain.MindVaultSprintStatus;
import com.flowdash.domain.MindVaultSubject;
import com.flowdash.dto.MindVaultResourceRequest;
import com.flowdash.repository.MindVaultLearningItemRepository;
import com.flowdash.repository.MindVaultResourceRepository;
import com.flowdash.repository.MindVaultReviewLogRepository;
import com.flowdash.repository.MindVaultSprintRepository;
import com.flowdash.repository.MindVaultSubjectRepository;
import com.flowdash.security.CurrentUserService;
import com.flowdash.service.exception.ResourceNotFoundException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.multipart.MultipartFile;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class MindVaultServiceTest {

    @Mock
    private MindVaultSubjectRepository subjectRepository;

    @Mock
    private MindVaultSprintRepository sprintRepository;

    @Mock
    private MindVaultLearningItemRepository itemRepository;

    @Mock
    private MindVaultReviewLogRepository reviewLogRepository;

    @Mock
    private MindVaultResourceRepository resourceRepository;

    @Mock
    private SupabaseStorageService supabaseStorageService;

    @Mock
    private CurrentUserService currentUserService;

    @InjectMocks
    private MindVaultService service;

    @Test
    void queueIncludesRandomAndOverdueItemsButSkipsMasteredTopics() {
        when(currentUserService.requireCurrentUserId()).thenReturn(1L);
        LocalDate today = LocalDate.now(ZoneOffset.UTC);
        when(itemRepository.findAllByUserIdOrderByUpdatedAtDesc(1L)).thenReturn(List.of(
                item(1L, null, null, MindVaultItemStatus.ACTIVE, MindVaultItemSource.RANDOM, today.minusDays(1), 5, 15),
                item(2L, null, null, MindVaultItemStatus.ACTIVE, MindVaultItemSource.PLANNED, today, 3, 25),
                item(3L, null, null, MindVaultItemStatus.MASTERED, MindVaultItemSource.PLANNED, today, 4, 90),
                item(4L, null, null, MindVaultItemStatus.ACTIVE, MindVaultItemSource.PLANNED, today.plusDays(2), 1, 50)
        ));

        List<MindVaultLearningItem> queue = service.queue();

        assertThat(queue).extracting(MindVaultLearningItem::getId).containsExactly(1L, 2L);
        assertThat(queue).noneMatch(item -> item.getStatus() == MindVaultItemStatus.MASTERED);
    }

    @Test
    void deleteSubjectRejectsAnotherUsersSubject() {
        AppUser owner = user(2L);
        MindVaultSubject subject = new MindVaultSubject(owner, "Physics", null, 3, 80, null, null, false);
        subject.setId(9L);

        when(currentUserService.requireCurrentUserId()).thenReturn(1L);
        when(subjectRepository.findById(9L)).thenReturn(Optional.of(subject));

        assertThatThrownBy(() -> service.deleteSubject(9L))
                .isInstanceOf(AccessDeniedException.class)
                .hasMessageContaining("current user");
    }

    @Test
    void reviewItemPersistsTheScheduledOutcomeAndLog() {
        AppUser user = user(1L);
        MindVaultSubject subject = new MindVaultSubject(user, "Math", null, 3, 80, null, null, false);
        subject.setId(11L);
        MindVaultLearningItem item = new MindVaultLearningItem(
                user,
                subject,
                null,
                MindVaultItemSource.PLANNED,
                "Matrices",
                "What is the determinant?",
                "A scalar summary.",
                null,
                null,
                3,
                3,
                84,
                2,
                4,
                3,
                2.1d,
                2,
                LocalDate.now(),
                Instant.now().minusSeconds(120),
                1,
                MindVaultItemStatus.ACTIVE,
                null
        );
        item.setId(21L);

        when(currentUserService.requireCurrentUserId()).thenReturn(1L);
        when(currentUserService.requireCurrentUser()).thenReturn(user);
        when(itemRepository.findById(21L)).thenReturn(Optional.of(item));
        when(itemRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
        when(reviewLogRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        var log = service.reviewItem(21L, new com.flowdash.dto.MindVaultReviewRequest(3, "solid recall"));

        ArgumentCaptor<MindVaultLearningItem> itemCaptor = ArgumentCaptor.forClass(MindVaultLearningItem.class);
        verify(itemRepository).save(itemCaptor.capture());
        MindVaultLearningItem saved = itemCaptor.getValue();

        assertThat(saved.getStatus()).isEqualTo(MindVaultItemStatus.MASTERED);
        assertThat(saved.getMasteryScore()).isGreaterThanOrEqualTo(80);
        assertThat(saved.getReviewCount()).isEqualTo(5);
        assertThat(log.getRating()).isEqualTo(3);
        assertThat(log.getMasteryAfter()).isGreaterThanOrEqualTo(80);
    }

    @Test
    void createResourceSavesTextMetadataForOwnedItem() {
        AppUser user = user(1L);
        MindVaultLearningItem item = item(21L, null, null, MindVaultItemStatus.ACTIVE, MindVaultItemSource.PLANNED, LocalDate.now(), 3, 20);

        when(currentUserService.requireCurrentUserId()).thenReturn(1L);
        when(currentUserService.requireCurrentUser()).thenReturn(user);
        when(itemRepository.findById(21L)).thenReturn(Optional.of(item));
        when(resourceRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        MindVaultResource resource = service.createResource(21L, new MindVaultResourceRequest(
                MindVaultResourceType.TEXT,
                "Class note",
                "Use this explanation as the recall seed.",
                null
        ));

        assertThat(resource.getUser()).isEqualTo(user);
        assertThat(resource.getItem()).isEqualTo(item);
        assertThat(resource.getResourceType()).isEqualTo(MindVaultResourceType.TEXT);
        assertThat(resource.getTitle()).isEqualTo("Class note");
        assertThat(resource.getDescription()).contains("recall seed");
        assertThat(resource.getStoragePath()).isNull();
    }

    @Test
    void uploadResourceSavesMetadataOnlyAfterSupabaseUploadSucceeds() {
        AppUser user = user(1L);
        MindVaultLearningItem item = item(22L, null, null, MindVaultItemStatus.ACTIVE, MindVaultItemSource.PLANNED, LocalDate.now(), 3, 20);
        MultipartFile file = org.mockito.Mockito.mock(MultipartFile.class);

        when(currentUserService.requireCurrentUserId()).thenReturn(1L);
        when(currentUserService.requireCurrentUser()).thenReturn(user);
        when(itemRepository.findById(22L)).thenReturn(Optional.of(item));
        when(supabaseStorageService.upload(1L, 22L, file)).thenReturn(new SupabaseStorageService.StoredObject(
                "mindvault/1/22/photo.png",
                "image/png",
                1200L,
                "photo.png"
        ));
        when(resourceRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        MindVaultResource resource = service.uploadResource(22L, "Lecture image", "Board diagram", file);

        assertThat(resource.getResourceType()).isEqualTo(MindVaultResourceType.IMAGE);
        assertThat(resource.getStoragePath()).isEqualTo("mindvault/1/22/photo.png");
        assertThat(resource.getMimeType()).isEqualTo("image/png");
        assertThat(resource.getOriginalFileName()).isEqualTo("photo.png");
        assertThat(resource.getSizeBytes()).isEqualTo(1200L);
    }

    @Test
    void failedSupabaseUploadDoesNotCreateResourceMetadata() {
        MindVaultLearningItem item = item(23L, null, null, MindVaultItemStatus.ACTIVE, MindVaultItemSource.PLANNED, LocalDate.now(), 3, 20);
        MultipartFile file = org.mockito.Mockito.mock(MultipartFile.class);

        when(currentUserService.requireCurrentUserId()).thenReturn(1L);
        when(itemRepository.findById(23L)).thenReturn(Optional.of(item));
        when(supabaseStorageService.upload(1L, 23L, file)).thenThrow(new IllegalStateException("Supabase upload failed"));

        assertThatThrownBy(() -> service.uploadResource(23L, "Broken upload", null, file))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Supabase upload failed");
        verify(resourceRepository, never()).save(any());
    }

    @Test
    void loadResourceContentReturnsOwnedFileBytes() {
        AppUser user = user(1L);
        MindVaultLearningItem item = item(24L, null, null, MindVaultItemStatus.ACTIVE, MindVaultItemSource.PLANNED, LocalDate.now(), 3, 20);
        MindVaultResource resource = new MindVaultResource(
                user,
                item,
                MindVaultResourceType.PDF,
                "Wave handout",
                null,
                null,
                "mindvault/1/24/waves.pdf",
                "application/pdf",
                512L,
                "waves.pdf"
        );
        resource.setId(33L);

        when(currentUserService.requireCurrentUserId()).thenReturn(1L);
        when(resourceRepository.findByIdAndUserId(33L, 1L)).thenReturn(Optional.of(resource));
        when(supabaseStorageService.download("mindvault/1/24/waves.pdf"))
                .thenReturn(new SupabaseStorageService.StoredContent("pdf-body".getBytes(), "application/pdf"));

        MindVaultService.StoredMindVaultResourceContent content = service.loadResourceContent(33L);

        assertThat(content.resource()).isEqualTo(resource);
        assertThat(content.fileName()).isEqualTo("waves.pdf");
        assertThat(content.mimeType()).isEqualTo("application/pdf");
        assertThat(new String(content.bytes())).isEqualTo("pdf-body");
    }

    @Test
    void loadResourceContentRejectsUnknownResource() {
        when(currentUserService.requireCurrentUserId()).thenReturn(1L);
        when(resourceRepository.findByIdAndUserId(77L, 1L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.loadResourceContent(77L))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessageContaining("Resource not found");
    }

    private static MindVaultLearningItem item(Long id, MindVaultSubject subject, MindVaultSprint sprint, MindVaultItemStatus status, MindVaultItemSource source, LocalDate dueDate, int priority, int mastery) {
        MindVaultLearningItem item = new MindVaultLearningItem(
                user(1L),
                subject,
                sprint,
                source,
                "Item " + id,
                "Prompt " + id,
                "Answer " + id,
                null,
                null,
                priority,
                3,
                mastery,
                0,
                1,
                0,
                2.1d,
                1,
                dueDate,
                null,
                null,
                status,
                dueDate
        );
        item.setId(id);
        item.setUpdatedAt(Instant.now());
        return item;
    }

    private static AppUser user(Long id) {
        AppUser user = new AppUser("arpit@example.com", "Arpit", null, AuthProvider.LOCAL, null);
        user.setId(id);
        return user;
    }
}
