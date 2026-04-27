package com.flowdash.web;

import com.flowdash.domain.AuthProvider;
import com.flowdash.domain.MindVaultResource;
import com.flowdash.domain.MindVaultResourceType;
import com.flowdash.service.MindVaultService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.HttpHeaders;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class MindVaultControllerIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private MindVaultService mindVaultService;

    @Test
    @WithMockUser(username = "arpit@example.com")
    void resourceContentServesOwnedPdfInline() throws Exception {
        var user = new com.flowdash.domain.AppUser("arpit@example.com", "Arpit", null, AuthProvider.LOCAL, null);
        var item = new com.flowdash.domain.MindVaultLearningItem(
                user,
                null,
                null,
                com.flowdash.domain.MindVaultItemSource.PLANNED,
                "Waves",
                null,
                null,
                null,
                null,
                3,
                3,
                20,
                0,
                0,
                0,
                2.1d,
                1,
                null,
                null,
                null,
                com.flowdash.domain.MindVaultItemStatus.ACTIVE,
                null
        );
        item.setId(8L);
        MindVaultResource resource = new MindVaultResource(
                user,
                item,
                MindVaultResourceType.PDF,
                "Waves",
                null,
                null,
                "mindvault/1/8/waves.pdf",
                "application/pdf",
                9L,
                "waves.pdf"
        );
        resource.setId(5L);
        when(mindVaultService.loadResourceContent(5L))
                .thenReturn(new MindVaultService.StoredMindVaultResourceContent(resource, "pdf-body".getBytes(), "application/pdf", "waves.pdf"));

        mockMvc.perform(get("/api/mindvault/resources/5/content"))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.CONTENT_TYPE, "application/pdf"))
                .andExpect(header().string(HttpHeaders.CONTENT_DISPOSITION, org.hamcrest.Matchers.containsString("inline")))
                .andExpect(content().bytes("pdf-body".getBytes()));
    }

    @Test
    void resourceContentRejectsUnauthenticatedRequests() throws Exception {
        mockMvc.perform(get("/api/mindvault/resources/5/content"))
                .andExpect(status().isUnauthorized());
    }
}
