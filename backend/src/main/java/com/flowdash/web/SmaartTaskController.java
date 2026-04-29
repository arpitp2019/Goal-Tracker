package com.flowdash.web;

import com.flowdash.dto.SmaartGoalDtos.TaskRequest;
import com.flowdash.dto.SmaartGoalDtos.TaskResponse;
import com.flowdash.dto.SmaartGoalDtos.TaskStatusRequest;
import com.flowdash.service.SmaartGoalService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/smaart-tasks")
public class SmaartTaskController {

    private final SmaartGoalService service;

    public SmaartTaskController(SmaartGoalService service) {
        this.service = service;
    }

    @PutMapping("/{taskId}")
    public TaskResponse updateTask(@PathVariable Long taskId, @Valid @RequestBody TaskRequest request) {
        return service.updateTask(taskId, request);
    }

    @PostMapping("/{taskId}/duplicate")
    public TaskResponse duplicateTask(@PathVariable Long taskId) {
        return service.duplicateTask(taskId);
    }

    @PatchMapping("/{taskId}/status")
    public TaskResponse updateTaskStatus(@PathVariable Long taskId, @RequestBody TaskStatusRequest request) {
        return service.updateTaskStatus(taskId, request.status());
    }

    @DeleteMapping("/{taskId}")
    public void deleteTask(@PathVariable Long taskId) {
        service.deleteTask(taskId);
    }
}
