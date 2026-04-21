package com.flowdash.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import java.time.LocalDate;

@Entity
@Table(
        name = "habit_checkin",
        uniqueConstraints = @UniqueConstraint(name = "uk_habit_checkin_habit_date", columnNames = {"habit_id", "checkin_date"})
)
public class HabitCheckin extends AuditFields {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    @JoinColumn(name = "user_id")
    private AppUser user;

    @ManyToOne(optional = false)
    @JoinColumn(name = "habit_id")
    private HabitItem habit;

    @Column(name = "checkin_date", nullable = false)
    private LocalDate checkinDate;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private HabitCheckinStatus status = HabitCheckinStatus.DONE;

    @Column(name = "checkin_value")
    private Double value;

    @Column(columnDefinition = "text")
    private String note;

    private Integer mood;

    private Integer energy;

    protected HabitCheckin() {
    }

    public HabitCheckin(AppUser user, HabitItem habit, LocalDate checkinDate, HabitCheckinStatus status, Double value, String note, Integer mood, Integer energy) {
        this.user = user;
        this.habit = habit;
        this.checkinDate = checkinDate;
        this.status = status == null ? HabitCheckinStatus.DONE : status;
        this.value = value;
        this.note = note;
        this.mood = mood;
        this.energy = energy;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public AppUser getUser() {
        return user;
    }

    public void setUser(AppUser user) {
        this.user = user;
    }

    public HabitItem getHabit() {
        return habit;
    }

    public void setHabit(HabitItem habit) {
        this.habit = habit;
    }

    public LocalDate getCheckinDate() {
        return checkinDate;
    }

    public void setCheckinDate(LocalDate checkinDate) {
        this.checkinDate = checkinDate;
    }

    public HabitCheckinStatus getStatus() {
        return status;
    }

    public void setStatus(HabitCheckinStatus status) {
        this.status = status;
    }

    public Double getValue() {
        return value;
    }

    public void setValue(Double value) {
        this.value = value;
    }

    public String getNote() {
        return note;
    }

    public void setNote(String note) {
        this.note = note;
    }

    public Integer getMood() {
        return mood;
    }

    public void setMood(Integer mood) {
        this.mood = mood;
    }

    public Integer getEnergy() {
        return energy;
    }

    public void setEnergy(Integer energy) {
        this.energy = energy;
    }
}
