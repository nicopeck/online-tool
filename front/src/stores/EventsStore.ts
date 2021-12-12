import { makeAutoObservable } from 'mobx'
import { stringOrDate } from 'react-big-calendar'
import { fetchEvents, getEventFromApi, postEvent, putEvent } from '../api/events'
import { ApiError, fetchBackendJson } from '../api/fetch'
import { notifyError } from '../utils/notification'

export type RoomEvent = {
    id: number
    start: Date
    end: Date
    title: string
    room: string
    allDay?: boolean
}

export type RawRoomEvent = Omit<RoomEvent, 'start' | 'end'> & {
    start: string
    end: string
}

export class EventsStore {
    public events: RoomEvent[] = []

    public roomName = ''

    constructor() {
        makeAutoObservable(this)
    }

    async init() {
        const events: RoomEvent[] = (await fetchEvents()).map((rawEvent: any) =>
            getEventFromApi(rawEvent)
        )
        this.appendEvents(events)
    }

    resetEvents() {
        this.events = []
        this.init()
    }

    setRoomName(name: string) {
        this.roomName = name
    }

    onEventDrop({
        event,
        start,
        end,
        resourceId: roomName,
    }: {
        event: any
        start: stringOrDate
        end: stringOrDate
        isAllDay: boolean
        resourceId?: string
    }) {
        const [startDate, endDate] = [new Date(start), new Date(end)]
        this.moveEvent(event?.id, startDate, endDate, roomName)
    }
    async newEvent(start: Date, end: Date, roomName = null) {
        return postEvent({
            start,
            end,
            room: roomName ?? this.roomName,
        })
    }
    onDoubleClickEvent(event: any) {
        if (event.id === 0) return
        return this.removeEvent(event.id)
    }
    async removeEvent(id: number) {
        const res = await fetchBackendJson<{ id: number; deleted: boolean }, ApiError>(
            `/events/${id}`,
            'DELETE'
        )
        if (!res.ok || !res.json.deleted) {
            return notifyError(`Erreur lors de la suprression de la réservation`)
        }
    }
    appendEvents(events: RoomEvent[]) {
        this.events = [...this.events, ...events]
    }
    setEvents(events: RoomEvent[]) {
        this.events = events
    }
    async moveEvent(eventId: number, start: Date, end: Date, roomName?: string) {
        const event = this.events.find((event) => event.id === eventId)
        if (!event) return
        try {
            await putEvent({
                id: event.id,
                start,
                end,
                room: roomName ?? event.room,
            })
        } catch (error) {
            notifyError(`Erreur lors de la mise à jour de la réservation`)
        }
    }

    updateEvent(event: RoomEvent, updateData: RoomEvent) {
        event.start = updateData.start
        event.end = updateData.end
        event.room = updateData.room
        event.title = updateData.title
    }

    getRoomEvents(roomName: string) {
        if (roomName === '*')
            return this.events.map((event) => {
                return { ...event, title: `${event.title} (${event.room})` }
            })
        return this.events.filter((event) => event.room === roomName || event.room === '*')
    }

    get roomEvents() {
        return this.getRoomEvents(this.roomName)
    }

    eventCollide(event: RoomEvent, date: Date): boolean {
        return !(date < event.start || date > event.end)
    }

    roomIsAvailable(roomName: string, date: Date) {
        const events = this.getRoomEvents(roomName)
        return events.every((event) => !this.eventCollide(event, date))
    }
}
